const logger = require("../utils/logger.util");

const preRequestMiddleware = (req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  req.requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2);

  res.setHeader("X-Request-ID", req.requestId);

  next();
};

module.exports = preRequestMiddleware;
