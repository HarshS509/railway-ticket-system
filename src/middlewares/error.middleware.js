const logger = require('../utils/logger.util');
const { HTTP_STATUS_CODES } = require('../config/const.config');

const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error({
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
    method: req.method
  });

  // Default error status and message
  const statusCode = err.statusCode || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Something went wrong!';

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      status: statusCode,
      requestId: req.requestId
    }
  });
};

module.exports = errorHandler; 