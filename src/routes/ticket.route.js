const express = require("express");
const TicketController = require("../controllers/ticket.controller");
const {
  validate,
  validateParams,
  schemas,
} = require("../validations/ticket.validation");

const router = express.Router();

// Book a ticket
router.post("/book", validate(schemas.bookTicket), TicketController.bookTicket);

// Cancel a ticket
router.post(
  "/cancel/:ticketId",
  validateParams(schemas.cancelTicket),
  TicketController.cancelTicket
);

// Get booked tickets
router.get("/booked", TicketController.getBookedTickets);

// Get available tickets
router.get("/available", TicketController.getAvailableTickets);

module.exports = router;
