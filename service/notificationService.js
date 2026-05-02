const logger = require("../../logging_middleware/logger");
const MinHeap = require("../utils/minHeap");
const { getAllNotifications } = require("../repository/notificationRepository");

const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function calculateScore(notification) {
  const typeWeight = TYPE_WEIGHT[notification.Type] || 1;
  const ageInMinutes = (Date.now() - new Date(notification.Timestamp).getTime()) / 60000;
  const recencyScore = 1 / (1 + ageInMinutes);
  return typeWeight * recencyScore * 100;
}

async function getTopNotifications(topN = 10) {
  try {
    logger.info("service", `Fetching top ${topN} priority notifications`);

    const notifications = await getAllNotifications();

    const scored = notifications.map((n) => ({
      ...n,
      score: parseFloat(calculateScore(n).toFixed(4)),
    }));

    const heap = new MinHeap((a, b) => a.score - b.score);

    for (const notif of scored) {
      if (heap.size() < topN) {
        heap.insert(notif);
      } else if (notif.score > heap.peek().score) {
        heap.extractMin();
        heap.insert(notif);
      }
    }

    const topNotifications = heap
      .toArray()
      .sort((a, b) => b.score - a.score);

    logger.info("service", `Top ${topN} notifications selected from ${notifications.length} total`);
    return topNotifications;
  } catch (err) {
    logger.error("service", `getTopNotifications failed: ${err.message}`);
    throw err;
  }
}

module.exports = { getTopNotifications };