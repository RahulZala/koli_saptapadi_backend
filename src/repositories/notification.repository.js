const pool = require("../config/database");
const { timeAgo } = require("../utils/dates");

class NotificationRepository {
  async createNotification(senderId, receiverId, title, message, type, referenceId) {
    const [rows] = await pool.execute(
      `INSERT INTO notifications (sender_id, receiver_id, title, message, type, reference_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [senderId, receiverId, title, message, type, referenceId]
    );
    return rows[0] ? rows[0].id : null;
  }

  async getNotificationList(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT * FROM notifications 
      WHERE receiver_id = $1
      ORDER BY id DESC 
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const notifications = rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type,
      created_at: row.created_at,
      is_read: row.is_read === true || row.is_read === 1 || row.is_read === "1" || row.is_read === "true",
      time: timeAgo(row.created_at)
    }));

    return {
      notifications,
      page,
      total: notifications.length
    };
  }

  async getUnreadCount(userId) {
    const [rows] = await pool.execute(
      "SELECT COUNT(*)::int AS unread_count FROM notifications WHERE receiver_id = $1 AND COALESCE(is_read::text, '0') IN ('0', 'false')",
      [userId]
    );
    return rows[0]?.unread_count ?? 0;
  }

  async markAllAsRead(userId) {
    await pool.execute(
      "UPDATE notifications SET is_read = '1' WHERE receiver_id = $1 AND COALESCE(is_read::text, '0') IN ('0', 'false')",
      [userId]
    );
  }

  async getUserFcmToken(userId) {
    const [rows] = await pool.execute(
      "SELECT fcm_token FROM users WHERE id = $1",
      [userId]
    );
    return rows[0] ? rows[0].fcm_token : null;
  }
}

module.exports = new NotificationRepository();
