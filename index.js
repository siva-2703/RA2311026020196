/**
 * Vehicle Maintenance Scheduler
 * Entry point for the Express application
 */

const express = require("express");
const logger = require("../logging_middleware/logger");
const { AUTH_TOKEN } = require("./config/config");
const vehicleRoutes = require("./route/vehicleRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Set auth token for logger
logger.setToken(AUTH_TOKEN);

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info("middleware", `${req.method} ${req.path} - request received`);
  next();
});

// Routes
app.use("/api", vehicleRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handler
app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info("handler", `Vehicle Maintenance Scheduler running on port ${PORT}`);
});

module.exports = app;