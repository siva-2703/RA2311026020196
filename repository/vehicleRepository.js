const axios = require("axios");
const logger = require("../../logging_middleware/logger");
const { AUTH_TOKEN, EVAL_BASE_URL } = require("../config/config");

async function getDepots() {
  try {
    logger.info("repository", "Fetching depots from evaluation server");
    const response = await axios.get(`${EVAL_BASE_URL}/depots`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    logger.info("repository", `Fetched ${response.data.depots.length} depots successfully`);
    return response.data.depots;
  } catch (err) {
    logger.error("repository", `Failed to fetch depots: ${err.message}`);
    throw new Error("Failed to fetch depots");
  }
}

async function getVehicles() {
  try {
    logger.info("repository", "Fetching vehicles from evaluation server");
    const response = await axios.get(`${EVAL_BASE_URL}/vehicles`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    logger.info("repository", `Fetched ${response.data.vehicles.length} vehicles successfully`);
    return response.data.vehicles;
  } catch (err) {
    logger.error("repository", `Failed to fetch vehicles: ${err.message}`);
    throw new Error("Failed to fetch vehicles");
  }
}

module.exports = { getDepots, getVehicles };