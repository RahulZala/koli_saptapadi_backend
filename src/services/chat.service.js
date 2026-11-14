const chatRepository = require("../repositories/chat.repository");
const interestRepository = require("../repositories/interest.repository");
const userRepository = require("../repositories/user.repository");
const blockRepository = require("../repositories/block.repository");
const notificationService = require("./notification.service");
const pool = require("../config/database");

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

class ChatService {
  async sendMessage(senderId, receiverId, message, messageType = "text") {
    const recipientId = positiveInteger(receiverId);
    if (!recipientId) {
      return { success: 0, message: "Recipient user ID is required" };
    }
    if (positiveInteger(senderId) === recipientId) {
      return { success: 0, message: "Cannot send message to yourself" };
    }
    if (typeof message !== "string" || !message.trim()) {
      return { success: 0, message: "Message content cannot be empty" };
    }
    if (message.trim().length > 2000) {
      return { success: 0, message: "Messages cannot exceed 2000 characters" };
    }
    if (messageType !== "text") {
      return { success: 0, message: "Only text messages are supported" };
    }

    // 1. Safety Ban Check: If either party reported the other, chat is banned ONLY between this specific pair!
    const isReported = await userRepository.isReportedBetween(senderId, recipientId);
    if (isReported) {
      return {
        success: 0,
        chat_blocked: true,
        message: "Chat has been disabled between you and this member due to a safety report."
      };
    }
    if (await blockRepository.isBlockedBetween(senderId, recipientId)) {
      return { success: 0, chat_blocked: true, message: "Chat is unavailable for this profile" };
    }

    // 2. Matrimonial Gatekeeper: Mutual interest must be accepted
    const hasAccepted = await interestRepository.hasAcceptedInterest(senderId, recipientId);
    if (!hasAccepted) {
      return {
        success: 0,
        message: "Direct messaging is locked until mutual interest is accepted."
      };
    }

    // 3. Subscription Check: User must have an active subscription plan to access chat
    const activeSub = await interestRepository.getActiveSubscription(senderId);
    if (!activeSub) {
      return {
        success: 0,
        message: "Your subscription plan is inactive or expired. Please purchase a plan to chat."
      };
    }

    // 4. Unlimited Instant Messaging inside chat: No per-message credit deduction!
    const saved = await chatRepository.sendMessage(senderId, recipientId, message.trim(), messageType);

    // Push notification to recipient
    try {
      const [senderRows] = await pool.execute("SELECT first_name, last_name FROM users WHERE id = $1", [senderId]);
      const senderName = senderRows[0] ? `${senderRows[0].first_name} ${senderRows[0].last_name}`.trim() : "Someone";
      await notificationService.createAndSendNotification(
        senderId,
        recipientId,
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
    const otherUserId = positiveInteger(partnerId);
    const requestedPage = Number(page);
    const requestedLimit = Number(limit);
    if (!otherUserId) {
      return { success: 0, message: "A valid partner user ID is required" };
    }
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      return { success: 0, message: "Page must be a positive integer" };
    }
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
      return { success: 0, message: "Limit must be between 1 and 100" };
    }

    // 1. Safety Ban Check: Banned only between this reported pair
    const isReported = await userRepository.isReportedBetween(userId, otherUserId);
    if (isReported) {
      return {
        success: 0,
        chat_blocked: true,
        message: "Chat between you and this member has been disabled due to a safety report."
      };
    }
    if (await blockRepository.isBlockedBetween(userId, otherUserId)) {
      return { success: 0, chat_blocked: true, message: "Chat is unavailable for this profile" };
    }

    // 2. Mutual Interest Verification
    const hasAccepted = await interestRepository.hasAcceptedInterest(userId, otherUserId);
    if (!hasAccepted) {
      return {
        success: 0,
        message: "Direct messaging is locked until mutual interest is accepted."
      };
    }

    // Fetch conversation message history with zero restriction once matched
    const messages = await chatRepository.getMessages(userId, otherUserId, requestedPage, requestedLimit);
    return {
      success: 1,
      data: {
        partner_id: otherUserId,
        page: requestedPage,
        limit: requestedLimit,
        has_more: messages.length === requestedLimit,
        messages
      }
    };
  }

  async getConversations(userId) {
    await userRepository.ensureReportTable();
    await blockRepository.ensureTable();
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
