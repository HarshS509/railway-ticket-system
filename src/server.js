const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const preRequestMiddleware = require("./middlewares/pre-request.middleware");
const errorHandler = require("./middlewares/error.middleware");
const logger = require("./utils/logger.util");
const httpError = require("./utils/http-error.util");
const {
  HTTP_STATUS_CODES,
  HTTP_STATUS_MESSAGES,
} = require("./config/const.config");
const database = require("./config/database.config");

dotenv.config();

const app = express();

// Common middlewares
app.use(bodyParser.json({ limit: "10mb" }));
app.use(morgan("combined", { stream: logger.stream }));
app.use(helmet());

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors());

// Import routes
const ticketRoutes = require("./routes/ticket.route");

// Application routes
app.use("/api/v1/tickets", preRequestMiddleware, ticketRoutes);

// Handle 404 requests
app.all("*", (req, res, next) => {
  next(httpError(HTTP_STATUS_MESSAGES.NOT_FOUND, HTTP_STATUS_CODES.NOT_FOUND));
});

// Error handler middleware
app.use(errorHandler);

// Run the application
const startServer = async () => {
  try {
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });
  } catch (error) {
    logger.error("Error starting the server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
