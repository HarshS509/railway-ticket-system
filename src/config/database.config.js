const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const logger = require("../utils/logger.util");

dotenv.config();

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "railway_user",
  password: process.env.DB_PASSWORD || "railway_password",
  database: process.env.DB_NAME || "railway_reservation",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Create connection pool
const createPool = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const pool = mysql.createPool(DB_CONFIG);

      // Test the connection
      const connection = await pool.getConnection();
      logger.info(
        `Database connected successfully to ${DB_CONFIG.host}:${DB_CONFIG.port}`
      );
      connection.release();
      return pool;
    } catch (err) {
      logger.error(`Database connection attempt ${i + 1} failed:`, err);
      if (i === retries - 1) throw err;
      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Initialize the pool
let pool;
createPool()
  .then((p) => {
    pool = p;
  })
  .catch((err) => {
    logger.error("Failed to initialize database connection:", err);
    process.exit(1);
  });

module.exports = {
  getConnection: async () => {
    if (!pool) {
      throw new Error("Database connection not initialized");
    }
    return pool.getConnection();
  },
  query: async (...args) => {
    if (!pool) {
      throw new Error("Database connection not initialized");
    }
    return pool.query(...args);
  },
  config: DB_CONFIG,
};
