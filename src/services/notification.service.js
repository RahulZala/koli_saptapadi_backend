const notificationRepository = require("../repositories/notification.repository");

class NotificationService {
  async createAndSendNotification(senderId, receiverId, title, message, type, referenceId) {
    // 1. Create DB Notification record
    await notificationRepository.createNotification(senderId, receiverId, title, message, type, referenceId);

    // 2. Trigger FCM Push Notification if token exists
    const fcmToken = await notificationRepository.getUserFcmToken(receiverId);
    if (fcmToken) {
      await this.sendFCMPushNotification(fcmToken, title, message);
    }
  }

  async sendFCMPushNotification(token, title, body) {
    // Standard Firebase HTTP v1 API structure placeholder/integration
    console.log(`[FCM Push] Sending notification to token: ${token.substring(0, 10)}... | Title: ${title}`);
    return true;
  }

  async getNotifications(userId, page = 1, limit = 10) {
    const data = await notificationRepository.getNotificationList(userId, parseInt(page, 10), parseInt(limit, 10));
    return {
      success: 1,
      data
    };
  }
}

module.exports = new NotificationService();
