const database = require("../config/database.config");
const httpError = require("../utils/http-error.util");
const logger = require("../utils/logger.util");
const {
  HTTP_STATUS_CODES,
  TICKET_STATUS,
  BERTH_STATUS,
  TICKET_LIMITS,
  BERTH_PRIORITY,
  BERTH_TYPES,
} = require("../config/const.config");

const RAC_SHARING_LIMIT = 2;

const generatePNR = () => {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
};

const getAvailableBerthsCount = async () => {
  const [rows] = await database.query(`
    SELECT 
      COUNT(CASE WHEN status = 'AVAILABLE' AND berth_type != 'SIDE_LOWER' THEN 1 END) as confirmed_available,
      COUNT(CASE WHEN status = 'AVAILABLE' AND berth_type = 'SIDE_LOWER' THEN 1 END) as rac_available,
      COUNT(CASE WHEN status = 'RAC' THEN 1 END) as rac_count,
      COUNT(CASE WHEN status = 'WAITING' THEN 1 END) as waiting_count,
      COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed_count,
      (
        SELECT COUNT(*) 
        FROM tickets t 
        JOIN berths b ON t.berth_id = b.id 
        WHERE b.berth_type = 'SIDE_LOWER' 
        AND t.status = 'RAC'
      ) as rac_passengers_count
    FROM berths
  `);
  return rows[0];
};

const getNextAvailableBerth = async (passenger, connection) => {
  const { age, gender, isWomanWithChildren } = passenger;
  let priority = BERTH_PRIORITY.REGULAR;

  if (age >= TICKET_LIMITS.SENIOR_CITIZEN_AGE) {
    priority = BERTH_PRIORITY.SENIOR_CITIZEN;
  } else if (isWomanWithChildren) {
    priority = BERTH_PRIORITY.WOMEN_WITH_CHILDREN;
  }

  if (priority <= BERTH_PRIORITY.WOMEN_WITH_CHILDREN) {
    const [lowerBerths] = await connection.query(`
      SELECT id, berth_number, berth_type 
      FROM berths 
      WHERE status = 'AVAILABLE' 
      AND berth_type = 'LOWER'
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);
    if (lowerBerths.length > 0) {
      return lowerBerths[0];
    }
  }

  const [berths] = await connection.query(`
    SELECT id, berth_number, berth_type 
    FROM berths 
    WHERE status = 'AVAILABLE' 
    AND berth_type != 'SIDE_LOWER'
    ORDER BY 
    CASE berth_type
    WHEN 'LOWER' THEN 1
    WHEN 'MIDDLE' THEN 2
    WHEN 'UPPER' THEN 3
    ELSE 4
    END,
    berth_number
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);
  if (berths.length > 0) {
    return berths[0];
  }

  return null;
};

const bookSingleTicket = async ({
  name,
  age,
  gender,
  isWomanWithChildren,
  isChild,
  connection,
  preAllocatedBerthId = null,
}) => {
  const ticketType = age < TICKET_LIMITS.CHILD_AGE_LIMIT ? "CHILD" : "ADULT";

  const [availableCounts] = await connection.query(`
    SELECT 
      COUNT(CASE WHEN status = 'AVAILABLE' AND berth_type != 'SIDE_LOWER' THEN 1 END) as confirmed_available,
      COUNT(CASE WHEN status = 'AVAILABLE' AND berth_type = 'SIDE_LOWER' THEN 1 END) as rac_available,
      COUNT(CASE WHEN status = 'RAC' THEN 1 END) as rac_count,
      COUNT(CASE WHEN status = 'WAITING' THEN 1 END) as waiting_count,
      COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed_count
    FROM berths
    FOR UPDATE
  `);

  if (ticketType === "CHILD") {
    const [passengerResult] = await connection.query(
      "INSERT INTO passengers (name, age, gender) VALUES (?, ?, ?)",
      [name, age, gender]
    );

    const pnrNumber = generatePNR();
    const [ticketResult] = await connection.query(
      "INSERT INTO tickets (pnr_number, status, passenger_id, ticket_type) VALUES (?, ?, ?, ?)",
      [pnrNumber, TICKET_STATUS.CONFIRMED, passengerResult.insertId, ticketType]
    );

    return {
      pnr: pnrNumber,
      status: TICKET_STATUS.CONFIRMED,
      berth: null,
      passenger: {
        name,
        age,
        gender,
        type: ticketType,
      },
    };
  }

  let status = TICKET_STATUS.CONFIRMED;
  let berth = null;

  if (preAllocatedBerthId) {
    const [berthResult] = await connection.query(
      `
      SELECT id, berth_number, berth_type 
      FROM berths 
      WHERE id = ? 
      AND status = 'AVAILABLE'
      FOR UPDATE
    `,
      [preAllocatedBerthId]
    );

    if (berthResult.length === 0) {
      throw httpError(
        "Pre-allocated berth is no longer available",
        HTTP_STATUS_CODES.CONFLICT
      );
    }

    berth = berthResult[0];
  } else {
    if (
      availableCounts[0].confirmed_count < TICKET_LIMITS.TOTAL_CONFIRMED_BERTHS
    ) {
      berth = await getNextAvailableBerth(
        { age, gender, isWomanWithChildren },
        connection
      );

      if (!berth) {
        throw httpError("No berths available", HTTP_STATUS_CODES.CONFLICT);
      }
    } else if (availableCounts[0].rac_count < TICKET_LIMITS.TOTAL_RAC_TICKETS) {
      const [racBerths] = await connection.query(
        `
        SELECT b.id, b.berth_number, b.berth_type,
          COUNT(t.id) as current_passengers
        FROM berths b
        LEFT JOIN tickets t ON b.id = t.berth_id AND t.status = 'RAC'
        WHERE b.berth_type = 'SIDE_LOWER'
        AND b.status = 'RAC'
        GROUP BY b.id
        HAVING current_passengers < ?
        FOR UPDATE
        LIMIT 1
      `,
        [RAC_SHARING_LIMIT]
      );

      if (racBerths.length > 0) {
        status = TICKET_STATUS.RAC;
        berth = racBerths[0];
      } else {
        const [newRacBerth] = await connection.query(`
          SELECT id, berth_number, berth_type 
          FROM berths 
          WHERE status = 'AVAILABLE' 
          AND berth_type = 'SIDE_LOWER'
          FOR UPDATE
          LIMIT 1
        `);

        if (newRacBerth.length > 0) {
          status = TICKET_STATUS.RAC;
          berth = newRacBerth[0];
        } else if (
          availableCounts[0].waiting_count < TICKET_LIMITS.MAX_WAITING_LIST
        ) {
          status = TICKET_STATUS.WAITING;
        } else {
          throw httpError("No tickets available", HTTP_STATUS_CODES.CONFLICT);
        }
      }
    } else if (
      availableCounts[0].waiting_count < TICKET_LIMITS.MAX_WAITING_LIST
    ) {
      status = TICKET_STATUS.WAITING;
    } else {
      throw httpError("No tickets available", HTTP_STATUS_CODES.CONFLICT);
    }
  }

  const [passengerResult] = await connection.query(
    "INSERT INTO passengers (name, age, gender) VALUES (?, ?, ?)",
    [name, age, gender]
  );

  const pnrNumber = generatePNR();
  const [ticketResult] = await connection.query(
    "INSERT INTO tickets (pnr_number, status, passenger_id, berth_id, ticket_type) VALUES (?, ?, ?, ?, ?)",
    [pnrNumber, status, passengerResult.insertId, berth?.id || null, ticketType]
  );

  if (berth) {
    const [updateResult] = await connection.query(
      "UPDATE berths SET status = ? WHERE id = ? AND status = 'AVAILABLE'",
      [status, berth.id]
    );

    if (updateResult.affectedRows === 0) {
      throw httpError(
        "Berth was taken by another user",
        HTTP_STATUS_CODES.CONFLICT
      );
    }
  }

  return {
    pnr: pnrNumber,
    status,
    berth: berth
      ? { number: berth.berth_number, type: berth.berth_type }
      : null,
    passenger: {
      name,
      age,
      gender,
      type: ticketType,
    },
  };
};

const bookTicket = async (passengerData) => {
  const connection = await database.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await connection.beginTransaction();

    const { name, age, gender, isMotherWithChildren, children } = passengerData;
    const results = [];

    if (isMotherWithChildren) {
      const hasYoungChild = children.some(
        (child) => child.age < TICKET_LIMITS.CHILD_AGE_LIMIT
      );

      const requiredBerths = children.length + 1;
      const [availableCount] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM berths 
        WHERE status = 'AVAILABLE' 
        AND berth_type != 'SIDE_LOWER'
      `);

      if (availableCount[0].count < requiredBerths) {
        throw httpError(
          "Not enough berths available for the entire family",
          HTTP_STATUS_CODES.CONFLICT
        );
      }

      const berthIds = [];
      for (let i = 0; i < requiredBerths; i++) {
        const [berths] = await connection.query(
          `
          SELECT id 
          FROM berths 
          WHERE status = 'AVAILABLE' 
          AND berth_type != 'SIDE_LOWER'
          AND id NOT IN (?)
          ORDER BY 
            CASE berth_type
              WHEN 'LOWER' THEN 1
              WHEN 'MIDDLE' THEN 2
              WHEN 'UPPER' THEN 3
              ELSE 4
            END,
            berth_number
          LIMIT 1
          FOR UPDATE
        `,
          [berthIds.length > 0 ? berthIds : [0]]
        );

        if (berths.length === 0) {
          throw httpError(
            "Failed to allocate required berths",
            HTTP_STATUS_CODES.CONFLICT
          );
        }

        berthIds.push(berths[0].id);
      }

      const motherResult = await bookSingleTicket({
        name,
        age,
        gender,
        isWomanWithChildren: hasYoungChild,
        connection,
        preAllocatedBerthId: berthIds[0],
      });
      results.push(motherResult);

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childResult = await bookSingleTicket({
          name: child.name,
          age: child.age,
          gender: child.gender,
          isChild: true,
          connection,
          preAllocatedBerthId: berthIds[i + 1],
        });
        results.push(childResult);
      }
    } else {
      const result = await bookSingleTicket({
        name,
        age,
        gender,
        isWomanWithChildren: false,
        connection,
      });
      results.push(result);
    }

    await connection.commit();
    return isMotherWithChildren ? { tickets: results } : results[0];
  } catch (error) {
    await connection.rollback();
    logger.error("Error booking ticket:", error);
    throw error;
  } finally {
    connection.release();
  }
};

const promoteRACTicket = async (connection, racTicket) => {
  const [availableBerth] = await connection.query(`
    SELECT id, berth_number, berth_type 
    FROM berths 
    WHERE status = 'AVAILABLE' 
    AND berth_type != 'SIDE_LOWER'
    FOR UPDATE
    LIMIT 1
  `);

  if (availableBerth.length === 0) {
    throw httpError(
      "No berths available for RAC promotion",
      HTTP_STATUS_CODES.CONFLICT
    );
  }

  await connection.query(
    "UPDATE tickets SET status = ?, berth_id = ? WHERE id = ?",
    [TICKET_STATUS.CONFIRMED, availableBerth[0].id, racTicket.id]
  );

  const [racPassengers] = await connection.query(
    `
    SELECT COUNT(*) as count 
    FROM tickets 
    WHERE berth_id = ? 
    AND status = 'RAC'
  `,
    [racTicket.berth_id]
  );

  if (racPassengers[0].count <= 1) {
    await connection.query("UPDATE berths SET status = ? WHERE id = ?", [
      BERTH_STATUS.AVAILABLE,
      racTicket.berth_id,
    ]);
  }

  await connection.query("UPDATE berths SET status = ? WHERE id = ?", [
    BERTH_STATUS.CONFIRMED,
    availableBerth[0].id,
  ]);

  return availableBerth[0];
};

const promoteWaitingTicket = async (connection, waitingTicket) => {
  const [racBerths] = await connection.query(
    `
    SELECT b.id, b.berth_number, b.berth_type,
      COUNT(t.id) as current_passengers
    FROM berths b
    LEFT JOIN tickets t ON b.id = t.berth_id AND t.status = 'RAC'
    WHERE b.berth_type = 'SIDE_LOWER'
    AND b.status = 'RAC'
    GROUP BY b.id
    HAVING current_passengers < ?
    FOR UPDATE
    LIMIT 1
  `,
    [RAC_SHARING_LIMIT]
  );

  let racBerth;
  if (racBerths.length > 0) {
    racBerth = racBerths[0];
  } else {
    const [newRacBerth] = await connection.query(`
      SELECT id, berth_number, berth_type 
      FROM berths 
      WHERE status = 'AVAILABLE' 
      AND berth_type = 'SIDE_LOWER'
      FOR UPDATE
      LIMIT 1
    `);

    if (newRacBerth.length === 0) {
      throw httpError(
        "No RAC berths available for waiting list promotion",
        HTTP_STATUS_CODES.CONFLICT
      );
    }

    racBerth = newRacBerth[0];
    await connection.query("UPDATE berths SET status = ? WHERE id = ?", [
      BERTH_STATUS.RAC,
      racBerth.id,
    ]);
  }

  await connection.query(
    "UPDATE tickets SET status = ?, berth_id = ? WHERE id = ?",
    [TICKET_STATUS.RAC, racBerth.id, waitingTicket.id]
  );

  return racBerth;
};

const cancelTicket = async (ticketId) => {
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();

    const [tickets] = await connection.query(
      `
      SELECT t.*, b.id as berth_id, b.berth_type, b.status as berth_status
      FROM tickets t
      LEFT JOIN berths b ON t.berth_id = b.id
      WHERE t.id = ? 
      AND t.status != 'CANCELLED'
      FOR UPDATE
    `,
      [ticketId]
    );

    if (tickets.length === 0) {
      throw httpError(
        "Ticket not found or already cancelled",
        HTTP_STATUS_CODES.NOT_FOUND
      );
    }

    const ticket = tickets[0];

    await connection.query("UPDATE tickets SET status = ? WHERE id = ?", [
      TICKET_STATUS.CANCELLED,
      ticketId,
    ]);

    if (ticket.berth_id) {
      if (ticket.status === TICKET_STATUS.CONFIRMED) {
        await connection.query("UPDATE berths SET status = ? WHERE id = ?", [
          BERTH_STATUS.AVAILABLE,
          ticket.berth_id,
        ]);

        const [racTickets] = await connection.query(`
          SELECT t.id, t.berth_id, t.passenger_id
          FROM tickets t
          JOIN berths b ON t.berth_id = b.id
          WHERE t.status = 'RAC'
          ORDER BY t.created_at ASC
          LIMIT 1
          FOR UPDATE
        `);

        if (racTickets.length > 0) {
          const racTicket = racTickets[0];
          try {
            await promoteRACTicket(connection, racTicket);

            const [waitingTickets] = await connection.query(`
              SELECT id 
              FROM tickets 
              WHERE status = 'WAITING'
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE
            `);

            if (waitingTickets.length > 0) {
              await promoteWaitingTicket(connection, waitingTickets[0]);
            }
          } catch (error) {
            logger.error(
              "Failed to promote tickets after cancellation:",
              error
            );
          }
        }
      } else if (ticket.status === TICKET_STATUS.RAC) {
        const [racPassengers] = await connection.query(
          `
          SELECT COUNT(*) as count 
          FROM tickets 
          WHERE berth_id = ? 
          AND status = 'RAC'
        `,
          [ticket.berth_id]
        );

        if (racPassengers[0].count <= 1) {
          await connection.query("UPDATE berths SET status = ? WHERE id = ?", [
            BERTH_STATUS.AVAILABLE,
            ticket.berth_id,
          ]);
        }
      }
    }

    await connection.commit();
    return { message: "Ticket cancelled successfully" };
  } catch (error) {
    await connection.rollback();
    logger.error("Error cancelling ticket:", error);
    throw error;
  } finally {
    connection.release();
  }
};

const getBookedTickets = async () => {
  const [tickets] = await database.query(
    `
    SELECT 
      t.id,
      t.pnr_number,
      t.status,
      t.ticket_type,
      t.created_at,
      p.name as passenger_name,
      p.age as passenger_age,
      p.gender as passenger_gender,
      b.berth_number,
      b.berth_type,
      CASE 
        WHEN p.age >= ? THEN 'SENIOR_CITIZEN'
        WHEN p.gender = 'F' AND p.age >= 18 AND EXISTS (
          SELECT 1 
          FROM tickets t2 
          JOIN passengers p2 ON t2.passenger_id = p2.id 
          WHERE p2.age < ?
          AND t2.created_at = t.created_at
        ) THEN 'WOMEN_WITH_CHILDREN'
        ELSE 'REGULAR'
      END as priority_category
    FROM tickets t
    JOIN passengers p ON t.passenger_id = p.id
    LEFT JOIN berths b ON t.berth_id = b.id
    WHERE t.status != 'CANCELLED'
    ORDER BY t.created_at DESC
  `,
    [TICKET_LIMITS.SENIOR_CITIZEN_AGE, TICKET_LIMITS.CHILD_AGE_LIMIT]
  );
  return tickets;
};

const getAvailableTickets = async () => {
  const [summary] = await database.query(
    `
    SELECT 
      COUNT(CASE WHEN status = 'AVAILABLE' AND berth_type != 'SIDE_LOWER' THEN 1 END) as regular_berths_available,
      COUNT(CASE WHEN status = 'AVAILABLE' AND berth_type = 'SIDE_LOWER' THEN 1 END) as RAC_berths_available,
      COUNT(CASE WHEN status = 'RAC' THEN 1 END) as RAC_berths_in_use,
      COUNT(CASE WHEN status = 'WAITING' THEN 1 END) as waiting_list_tickets,
      COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as regular_berths_booked,
      ? - (
        SELECT COUNT(*) 
        FROM tickets t 
        JOIN berths b ON t.berth_id = b.id 
        WHERE b.berth_type = 'SIDE_LOWER' 
        AND t.status = 'RAC'
      ) as RAC_tickets_remaining,
      ? - COUNT(CASE WHEN status = 'WAITING' THEN 1 END) as waiting_list_remaining,
      (
        SELECT COUNT(*) 
        FROM tickets t 
        JOIN berths b ON t.berth_id = b.id 
        WHERE b.berth_type = 'SIDE_LOWER' 
        AND t.status = 'RAC'
      ) as RAC_tickets_booked,
      ? as total_regular_berths,
      ? as total_RAC_berths
    FROM berths
  `,
    [
      TICKET_LIMITS.TOTAL_RAC_TICKETS,
      TICKET_LIMITS.MAX_WAITING_LIST,
      TICKET_LIMITS.TOTAL_CONFIRMED_BERTHS,
      TICKET_LIMITS.TOTAL_RAC_TICKETS / 2,
    ]
  );

  const [availableBerths] = await database.query(`
    SELECT 
      berth_number,
      berth_type,
      CASE 
        WHEN berth_type = 'SIDE_LOWER' THEN
          COALESCE(
            (SELECT COUNT(*) FROM tickets t WHERE t.berth_id = berths.id AND t.status = 'RAC'),
            0
          )
        ELSE NULL
      END as current_rac_passengers
    FROM berths
    WHERE status = 'AVAILABLE' OR (status = 'RAC' AND berth_type = 'SIDE_LOWER')
    ORDER BY 
      CASE 
        WHEN berth_type = 'LOWER' THEN 1
        WHEN berth_type = 'MIDDLE' THEN 2
        WHEN berth_type = 'UPPER' THEN 3
        WHEN berth_type = 'SIDE_LOWER' THEN 4
      END,
      berth_number
  `);

  const transformedBerths = availableBerths.map((berth) => {
    const baseBerth = {
      berth_number: berth.berth_number,
      berth_type: berth.berth_type,
    };

    // Add current_rac_passengers for side-lower berths
    if (berth.berth_type === "SIDE_LOWER") {
      baseBerth.current_rac_passengers = berth.current_rac_passengers;
    }

    return baseBerth;
  });

  return {
    summary: summary[0],
    available_berths: transformedBerths,
  };
};

module.exports = {
  bookTicket,
  cancelTicket,
  getBookedTickets,
  getAvailableTickets,
};
