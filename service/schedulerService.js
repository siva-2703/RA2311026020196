/**
 * Vehicle Scheduling Service
 * Contains the core scheduling algorithm.
 * Assigns tasks to depots to maximize total impact
 * without exceeding available mechanic hours.
 *
 * Algorithm: Greedy approach - sort by Impact/Duration ratio (efficiency),
 * assign to first depot that has enough remaining hours.
 * No external algorithm libraries used.
 */

const logger = require("../../logging_middleware/logger");
const { getDepots, getVehicles } = require("../repository/vehicleRepository");

/**
 * Core scheduling algorithm
 * Greedy: sort tasks by impact-to-duration ratio descending,
 * then assign each task to the depot with the most remaining hours
 * that can still fit the task.
 *
 * @param {Array} depots - Array of { ID, MechanicHours }
 * @param {Array} tasks  - Array of { TaskID, Duration, Impact }
 * @returns {Object} schedule result
 */
function scheduleTasksToDepots(depots, tasks) {
  logger.info("service", `Starting scheduling: ${tasks.length} tasks across ${depots.length} depots`);

  // Sort tasks by Impact/Duration ratio descending (highest efficiency first)
  const sortedTasks = [...tasks].sort((a, b) => {
    const ratioA = a.Impact / a.Duration;
    const ratioB = b.Impact / b.Duration;
    return ratioB - ratioA;
  });

  // Track remaining hours per depot
  const depotState = depots.map((d) => ({
    depotID: d.ID,
    totalHours: d.MechanicHours,
    remainingHours: d.MechanicHours,
    tasks: [],
    allocatedHours: 0,
  }));

  const unscheduledTasks = [];

  for (const task of sortedTasks) {
    // Find depot with most remaining hours that can fit this task
    const eligibleDepots = depotState
      .filter((d) => d.remainingHours >= task.Duration)
      .sort((a, b) => b.remainingHours - a.remainingHours);

    if (eligibleDepots.length === 0) {
      logger.warn("service", `Task ${task.TaskID} could not be scheduled - insufficient hours in all depots`);
      unscheduledTasks.push(task);
      continue;
    }

    const chosen = eligibleDepots[0];
    chosen.tasks.push({
      TaskID: task.TaskID,
      Duration: task.Duration,
      Impact: task.Impact,
    });
    chosen.remainingHours -= task.Duration;
    chosen.allocatedHours += task.Duration;
  }

  const totalImpact = depotState.reduce(
    (sum, d) => sum + d.tasks.reduce((s, t) => s + t.Impact, 0),
    0
  );

  logger.info("service", `Scheduling complete. Total impact: ${totalImpact}. Unscheduled: ${unscheduledTasks.length}`);

  return {
    schedule: depotState.map((d) => ({
      depotID: d.depotID,
      totalHours: d.totalHours,
      allocatedHours: d.allocatedHours,
      remainingHours: d.remainingHours,
      tasksCount: d.tasks.length,
      tasks: d.tasks,
    })),
    summary: {
      totalTasks: tasks.length,
      scheduledTasks: tasks.length - unscheduledTasks.length,
      unscheduledTasks: unscheduledTasks.length,
      totalImpact,
    },
    unscheduledTasks,
  };
}

/**
 * Fetch data and run scheduling
 */
async function runSchedule() {
  try {
    logger.info("service", "Starting full schedule run");
    const [depots, tasks] = await Promise.all([getDepots(), getVehicles()]);
    const result = scheduleTasksToDepots(depots, tasks);
    return result;
  } catch (err) {
    logger.error("service", `Schedule run failed: ${err.message}`);
    throw err;
  }
}

/**
 * Get depots only
 */
async function fetchDepots() {
  return await getDepots();
}

/**
 * Get vehicles only
 */
async function fetchVehicles() {
  return await getVehicles();
}

module.exports = { runSchedule, fetchDepots, fetchVehicles };