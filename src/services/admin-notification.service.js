const adminNotificationRepository = require("../repositories/admin-notification.repository");
const notificationService = require("./notification.service");

class AdminNotificationService {
  async send({ audience, userId, title, message }) {
    const recipients = await adminNotificationRepository.getActiveRecipients(audience, userId);
    if (audience === "user" && recipients.length === 0) {
      return { success: 0, status: 404, message: "Active user not found" };
    }
    if (recipients.length === 0) {
      return { success: 0, status: 404, message: "No active users found" };
    }

    const recipientIds = recipients.map((recipient) => recipient.id);
    await adminNotificationRepository.createAnnouncementNotifications(recipientIds, title, message);

    const tokens = [...new Set(recipients.map((recipient) => recipient.fcm_token).filter(Boolean))];
    let pushSent = 0;
    let pushFailed = 0;

    for (let i = 0; i < tokens.length; i += 10) {
      const batch = tokens.slice(i, i + 10);
      const results = await Promise.all(batch.map(async (token) => {
        try {
          await notificationService.sendFCMPushNotification(token, title, message);
          return true;
        } catch (err) {
          console.error(`[admin-notifications] FCM delivery failed: ${err.message}`);
          return false;
        }
      }));
      pushSent += results.filter(Boolean).length;
      pushFailed += results.length - results.filter(Boolean).length;
    }

    return {
      success: 1,
      data: {
        recipients: recipients.length,
        push_sent: pushSent,
        push_failed: pushFailed,
        without_device_token: recipients.filter((recipient) => !recipient.fcm_token).length
      }
    };
  }
}

module.exports = new AdminNotificationService();
