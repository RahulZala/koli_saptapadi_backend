const pool = require("../config/database");

class ChatRepository {
  constructor() {
    this.schemaReady = null;
  }

  async ensureTable() {
    if (!this.schemaReady) {
      this.schemaReady = pool.query(`
        CREATE TABLE IF NOT EXISTS user_messages (
          id SERIAL PRIMARY KEY,
          sender_id INT NOT NULL,
          receiver_id INT NOT NULL,
          message TEXT NOT NULL,
          message_type VARCHAR(20) DEFAULT 'text',
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_messages_participants ON user_messages(sender_id, receiver_id);
        CREATE INDEX IF NOT EXISTS idx_messages_participants_reverse ON user_messages(receiver_id, sender_id);
      `).catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    }
    await this.schemaReady;
  }

  async sendMessage(senderId, receiverId, message, messageType = "text") {
    await this.ensureTable();
    const [rows] = await pool.execute(
      `INSERT INTO user_messages (sender_id, receiver_id, message, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, receiver_id, message, message_type, is_read, created_at`,
      [senderId, receiverId, message, messageType]
    );
    return rows[0];
  }

  async getMessages(user1, user2, page = 1, limit = 50) {
    await this.ensureTable();
    const offset = (page - 1) * limit;

    // Mark incoming messages as read
    await pool.execute(
      "UPDATE user_messages SET is_read = true WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false",
      [user1, user2]
    );

    const [rows] = await pool.execute(
      `SELECT id, sender_id, receiver_id, message, message_type, is_read, created_at
       FROM user_messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC, id DESC
       LIMIT $3 OFFSET $4`,
      [user1, user2, limit, offset]
    );

    return (rows || []).reverse();
  }

  async getConversations(userId) {
    await this.ensureTable();
    const sql = `
      SELECT * FROM (
        SELECT DISTINCT ON (partner_id)
        partner_id,
        u.first_name, u.last_name, u.sub_caste,
        up.profile,
        m.message AS last_message,
        m.created_at AS last_message_at,
        m.sender_id AS last_sender_id,
        (
          SELECT COUNT(*) FROM user_messages 
          WHERE sender_id = partner_id AND receiver_id = $1 AND is_read = false
        ) AS unread_count
      FROM (
        SELECT 
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id,
          id, message, created_at, sender_id
        FROM user_messages
        WHERE (sender_id = $1 OR receiver_id = $1)
          AND EXISTS (
            SELECT 1
            FROM interests i
            WHERE i.status = 'accepted'
              AND ((i.from_user = $1 AND i.to_user = CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END)
                OR (i.to_user = $1 AND i.from_user = CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END))
          )
          AND NOT EXISTS (
            SELECT 1
            FROM user_reports r
            WHERE (r.from_user_id = $1 AND r.to_user_id = CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END)
               OR (r.to_user_id = $1 AND r.from_user_id = CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM user_blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_id = CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END)
               OR (b.blocked_id = $1 AND b.blocker_id = CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END)
          )
      ) m
      INNER JOIN users u ON u.id = m.partner_id
      LEFT JOIN user_document up ON up.user_id = u.id
      ORDER BY partner_id, m.created_at DESC, m.id DESC
      ) conversations
      ORDER BY last_message_at DESC
    `;
    const [rows] = await pool.execute(sql, [userId]);
    return rows || [];
  }
}

module.exports = new ChatRepository();
