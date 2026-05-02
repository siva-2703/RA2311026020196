const logger = require("../../logging_middleware/logger");
const { getTopNotifications } = require("../service/notificationService");

async function getTopPriorityNotifications(req, res, next) {
  try {
    const n = parseInt(req.query.n) || 10;
    logger.info("handler", `GET /api/notifications/top?n=${n} - fetching top notifications`);

    if (n < 1 || n > 100) {
      logger.warn("handler", `Invalid n value: ${n}`);
      return res.status(400).json({ error: "n must be between 1 and 100" });
    }

    const notifications = await getTopNotifications(n);
    logger.info("handler", `Returning ${notifications.length} top priority notifications`);

    res.status(200).json({
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    logger.error("handler", `getTopPriorityNotifications failed: ${err.message}`);
    next(err);
  }
}

module.exports = { getTopPriorityNotifications };