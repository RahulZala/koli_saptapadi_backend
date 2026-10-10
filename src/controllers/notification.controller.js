const notificationService = require("../services/notification.service");

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const { page, limit } = req.body;
      const result = await notificationService.getNotifications(req.userId, page, limit);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const result = await notificationService.getUnreadCount(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
