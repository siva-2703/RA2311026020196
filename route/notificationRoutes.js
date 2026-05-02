const express = require("express");
const router = express.Router();
const { getTopPriorityNotifications } = require("../handler/notificationHandler");

// GET /api/notifications/top?n=10
router.get("/notifications/top", getTopPriorityNotifications);

module.exports = router;