const pool = require("../config/database");

class AdminNotificationRepository {
  async getActiveRecipients(audience, userId) {
    const where = audience === "all" ? "is_active = true" : "is_active = true AND id = $1";
    const params = audience === "all" ? [] : [userId];
    const [rows] = await pool.execute(
      `SELECT id, fcm_token FROM users WHERE ${where} ORDER BY id`,
      params
    );
    return rows;
  }

  async createAnnouncementNotifications(userIds, title, message) {
    if (!userIds.length) return;
    await pool.execute(
      `INSERT INTO notifications (sender_id, receiver_id, title, message, type, reference_id)
       SELECT NULL, u.id, $2, $3, 'admin_announcement', NULL
       FROM users u
       WHERE u.id = ANY($1::int[]) AND u.is_active = true`,
      [userIds, title, message]
    );
  }
}

module.exports = new AdminNotificationRepository();
