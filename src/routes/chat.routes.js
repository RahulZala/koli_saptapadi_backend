const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/chat/send", "/calls/chat/send"], authenticateUser, chatController.sendMessage);
router.post(["/chat/messages", "/calls/chat/messages"], authenticateUser, chatController.getMessages);
router.post(["/chat/conversations", "/calls/chat/conversations"], authenticateUser, chatController.getConversations);

module.exports = router;
