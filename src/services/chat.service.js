const chatRepository = require("../repositories/chat.repository");
const interestRepository = require("../repositories/interest.repository");
const notificationService = require("./notification.service");
const pool = require("../config/database");

class ChatService {
  async sendMessage(senderId, receiverId, message, messageType = "text") {
    if (!receiverId || parseInt(receiverId, 10) <= 0) {
      return { success: 0, message: "Recipient user ID is required" };
    }
    if (parseInt(senderId, 10) === parseInt(receiverId, 10)) {
      return { success: 0, message: "Cannot send message to yourself" };
    }
    if (!message || !String(message).trim()) {
      return { success: 0, message: "Message content cannot be empty" };
    }

    // Security Rule 1: Mutual Interest Verification
    const hasAccepted = await interestRepository.hasAcceptedInterest(senderId, receiverId);
    if (!hasAccepted) {
      return {
        success: 0,
        message: "Direct messaging is locked until mutual interest is accepted."
      };
    }

    // Security Rule 2: Active Plan Check
    const activeSub = await interestRepository.getActiveSubscription(senderId);
    if (!activeSub || activeSub.remaining_interests <= 0) {
      return {
        success: 0,
        message: "Your subscription plan is expired or inactive. Please upgrade to chat."
      };
    }

    const saved = await chatRepository.sendMessage(senderId, receiverId, String(message).trim(), messageType);

    // Push notification to recipient
    try {
      const [senderRows] = await pool.execute("SELECT first_name, last_name FROM users WHERE id = $1", [senderId]);
      const senderName = senderRows[0] ? `${senderRows[0].first_name} ${senderRows[0].last_name}`.trim() : "Someone";
      await notificationService.createAndSendNotification(
        senderId,
        receiverId,
        `New Message from ${senderName}`,
        String(message).slice(0, 100),
        "chat_message",
        saved.id
      );
    } catch (err) {
      console.warn("Notice sending chat FCM notification:", err.message);
    }

    return {
      success: 1,
      message: "Message sent",
      data: saved
    };
  }

  async getMessages(userId, partnerId, page = 1, limit = 50) {
    if (!partnerId) {
      return { success: 0, message: "Partner user ID required" };
    }

    const hasAccepted = await interestRepository.hasAcceptedInterest(userId, partnerId);
    if (!hasAccepted) {
      return {
        success: 0,
        message: "Access denied. Chat history only available for accepted matches."
      };
    }

    const messages = await chatRepository.getMessages(userId, partnerId, page, limit);
    return {
      success: 1,
      data: {
        partner_id: parseInt(partnerId, 10),
        messages
      }
    };
  }

  async getConversations(userId) {
    const conversations = await chatRepository.getConversations(userId);
    return {
      success: 1,
      data: {
        conversations
      }
    };
  }
}

module.exports = new ChatService();
