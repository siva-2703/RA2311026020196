const logger = require("../../logging_middleware/logger");
function errorMiddleware(err, req, res, next) {
  logger.error("middleware", `Unhandled error: ${err.message}`);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
}
module.exports = errorMiddleware;