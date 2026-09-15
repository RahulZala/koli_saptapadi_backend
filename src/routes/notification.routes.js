const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/notification_list", authenticateUser, notificationController.getNotifications);

module.exports = router;
