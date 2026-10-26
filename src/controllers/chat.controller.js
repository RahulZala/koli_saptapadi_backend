const chatService = require("../services/chat.service");

class ChatController {
  async sendMessage(req, res, next) {
    try {
      const { to_user_id, partner_id, receiver_id, message, message_type } = req.body;
      const recipientId = to_user_id || partner_id || receiver_id;
      const result = await chatService.sendMessage(req.userId, recipientId, message, message_type);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMessages(req, res, next) {
    try {
      const { partner_id, to_user_id, page, limit } = req.body;
      const partner = partner_id || to_user_id || req.query.partner_id;
      const result = await chatService.getMessages(req.userId, partner, page, limit);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getConversations(req, res, next) {
    try {
      const result = await chatService.getConversations(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ChatController();
