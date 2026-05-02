/**
 * Vehicle Handler
 * Handles HTTP requests and sends responses
 */

const logger = require("../../logging_middleware/logger");
const { runSchedule, fetchDepots, fetchVehicles } = require("../service/schedulerService");

/**
 * GET /api/depots
 * Returns all depots with mechanic hours
 */
async function getDepots(req, res, next) {
  try {
    logger.info("handler", "GET /api/depots - fetching depots");
    const depots = await fetchDepots();
    logger.info("handler", `GET /api/depots - returned ${depots.length} depots`);
    res.status(200).json({ depots });
  } catch (err) {
    logger.error("handler", `GET /api/depots failed: ${err.message}`);
    next(err);
  }
}

/**
 * GET /api/vehicles
 * Returns all vehicle maintenance tasks
 */
async function getVehicles(req, res, next) {
  try {
    logger.info("handler", "GET /api/vehicles - fetching vehicles");
    const vehicles = await fetchVehicles();
    logger.info("handler", `GET /api/vehicles - returned ${vehicles.length} vehicles`);
    res.status(200).json({ vehicles });
  } catch (err) {
    logger.error("handler", `GET /api/vehicles failed: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/schedule
 * Runs the scheduling algorithm and returns results
 */
async function scheduleVehicles(req, res, next) {
  try {
    logger.info("handler", "POST /api/schedule - running scheduler");
    const result = await runSchedule();
    logger.info("handler", `POST /api/schedule - completed. Scheduled: ${result.summary.scheduledTasks}/${result.summary.totalTasks} tasks`);
    res.status(200).json(result);
  } catch (err) {
    logger.error("handler", `POST /api/schedule failed: ${err.message}`);
    next(err);
  }
}

module.exports = { getDepots, getVehicles, scheduleVehicles };