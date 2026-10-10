const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/notification_list", authenticateUser, notificationController.getNotifications);
router.post("/notification_count", authenticateUser, notificationController.getUnreadCount);

module.exports = router;
