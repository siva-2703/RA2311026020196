const axios = require("axios");
const logger = require("../../logging_middleware/logger");
const { AUTH_TOKEN, EVAL_BASE_URL } = require("../config/config");

const apiClient = axios.create({
  baseURL: EVAL_BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    "Content-Type": "application/json",
  },
});

async function getAllNotifications() {
  try {
    logger.info("repository", "Fetching notifications from evaluation server");
    const response = await apiClient.get("/notifications");
    logger.info("repository", `Fetched ${response.data.notifications.length} notifications`);
    return response.data.notifications;
  } catch (err) {
    logger.error("repository", `Failed to fetch notifications: ${err.message}`);
    throw new Error("Failed to fetch notifications");
  }
}

module.exports = { getAllNotifications };