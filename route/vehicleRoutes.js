/**
 * Vehicle Routes
 */

const express = require("express");
const router = express.Router();
const { getDepots, getVehicles, scheduleVehicles } = require("../handler/vehicleHandler");

// GET /api/depots - fetch all depots
router.get("/depots", getDepots);

// GET /api/vehicles - fetch all vehicle tasks
router.get("/vehicles", getVehicles);

// POST /api/schedule - run scheduling algorithm
router.post("/schedule", scheduleVehicles);

module.exports = router;