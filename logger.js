/**
 * Logging Middleware
 * Sends logs to the Affordmed evaluation server.
 * Use this instead of console.log everywhere in your app.
 */

const axios = require("axios");

const LOG_API_URL = "http://20.207.122.201/evaluation-service/log";

// Store the token - call setToken() after you get your auth token
let authToken = "";

/**
 * Set the Bearer token for logging API authentication
 * @param {string} token - Bearer token from /evaluation-service/auth
 */
function setToken(token) {
  authToken = token;
}

/**
 * Send a log to the evaluation server
 * @param {string} stack - "backend" or "frontend"
 * @param {string} level - "info" | "error" | "warn"
 * @param {string} pkg - package name e.g. "handler", "service", "repository", "middleware", "route"
 * @param {string} message - log message
 */
async function log(stack, level, pkg, message) {
  try {
    const response = await axios.post(
      LOG_API_URL,
      {
        stack,
        level,
        package: pkg,
        message,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (err) {
    // Fallback only - do not use console.log elsewhere in app
    process.stderr.write(
      `[LOG FAILED] ${level} | ${pkg} | ${message} | ${err.message}\n`
    );
  }
}

// Convenience wrappers
const logger = {
  setToken,
  info: (pkg, message) => log("backend", "info", pkg, message),
  error: (pkg, message) => log("backend", "error", pkg, message),
  warn: (pkg, message) => log("backend", "warn", pkg, message),
};

module.exports = logger;