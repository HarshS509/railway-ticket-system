const TicketService = require("../services/ticket.service");
const httpError = require("../utils/http-error.util");
const {
  HTTP_STATUS_CODES,
  HTTP_STATUS_MESSAGES,
} = require("../config/const.config");

const bookTicket = async (req, res, next) => {
  try {
    const { name, age, gender, isMotherWithChildren, children } = req.body;

    if (!name || !age || !gender) {
      throw httpError(
        "Name, age, and gender are required",
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    if (age < 0 || age > 120) {
      throw httpError("Invalid age", HTTP_STATUS_CODES.BAD_REQUEST);
    }

    if (!["M", "F", "O"].includes(gender)) {
      throw httpError(
        "Invalid gender. Must be M, F, or O",
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    if (isMotherWithChildren) {
      if (gender !== "F") {
        throw httpError(
          "Only female passengers can book with children",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }
      if (age < 18) {
        throw httpError(
          "Mother must be at least 18 years old",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }
      if (!children || !Array.isArray(children) || children.length === 0) {
        throw httpError(
          "At least one child is required when booking as mother with children",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }
      if (children.length > 4) {
        throw httpError(
          "Maximum 4 children allowed",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }
    }

    const result = await TicketService.bookTicket({
      name,
      age,
      gender,
      isMotherWithChildren,
      children,
    });
    res.status(HTTP_STATUS_CODES.CREATED).json({
      success: true,
      message: HTTP_STATUS_MESSAGES.CREATED,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const cancelTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      throw httpError("Ticket ID is required", HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const result = await TicketService.cancelTicket(ticketId);
    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: HTTP_STATUS_MESSAGES.OK,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getBookedTickets = async (req, res, next) => {
  try {
    const tickets = await TicketService.getBookedTickets();
    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: HTTP_STATUS_MESSAGES.OK,
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

// Get available tickets
const getAvailableTickets = async (req, res, next) => {
  try {
    const tickets = await TicketService.getAvailableTickets();
    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: HTTP_STATUS_MESSAGES.OK,
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookTicket,
  cancelTicket,
  getBookedTickets,
  getAvailableTickets,
};
