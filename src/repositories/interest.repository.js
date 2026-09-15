const pool = require("../config/database");

class InterestRepository {
  async getActiveSubscription(userId) {
    const [rows] = await pool.execute(
      "SELECT * FROM user_subscriptions WHERE user_id = $1 AND is_active = 1 AND end_date >= CURRENT_DATE",
      [userId]
    );
    return rows[0] || null;
  }

  async checkExistingInterest(fromUser, toUser) {
    const [rows] = await pool.execute(
      "SELECT id FROM interests WHERE from_user = $1 AND to_user = $2",
      [fromUser, toUser]
    );
    return rows.length > 0;
  }

  async consumeProfileView(userId) {
    const sub = await this.getActiveSubscription(userId);
    if (!sub) return { success: 0, message: "Subscription expired" };
    if (sub.remaining_interests <= 0) return { success: 0, message: "Interest limit exceeded" };

    await pool.execute(
      "UPDATE user_subscriptions SET remaining_interests = remaining_interests - 1 WHERE id = $1",
      [sub.id]
    );
    return { success: 1 };
  }

  async sendInterest(fromUser, toUser) {
    const [rows] = await pool.execute(
      "INSERT INTO interests (from_user, to_user) VALUES ($1, $2) RETURNING id",
      [fromUser, toUser]
    );
    return rows[0] ? rows[0].id : null;
  }

  async getInterestById(interestId, toUser) {
    const [rows] = await pool.execute(
      "SELECT id, from_user, status FROM interests WHERE id = $1 AND to_user = $2",
      [interestId, toUser]
    );
    return rows[0] || null;
  }

  async updateInterestStatus(interestId, status) {
    await pool.execute(
      "UPDATE interests SET status = $1 WHERE id = $2",
      [status, interestId]
    );
  }

  async getInterestsList(userId, type) {
    let query = "";
    if (type === 0) {
      // Received interests
      query = `
        SELECT 
          i.id AS interest_id, i.status, i.created_at,
          u.id AS from_user_id, u.first_name, u.last_name,
          ud.profile
        FROM interests i
        INNER JOIN users u ON u.id = i.from_user
        LEFT JOIN user_document ud ON ud.user_id = i.from_user
        WHERE i.to_user = $1
        ORDER BY i.id DESC
      `;
    } else {
      // Sent interests
      query = `
        SELECT 
          i.id AS interest_id, i.status, i.created_at,
          u.id AS to_user_id, u.first_name, u.last_name,
          ud.profile
        FROM interests i
        INNER JOIN users u ON u.id = i.to_user
        LEFT JOIN user_document ud ON ud.user_id = i.to_user
        WHERE i.from_user = $1
        ORDER BY i.id DESC
      `;
    }

    const [rows] = await pool.execute(query, [userId]);
    return rows;
  }

  async hasAcceptedInterest(viewerId, profileUserId) {
    const [rows] = await pool.execute(
      `SELECT id FROM interests
      WHERE ((from_user = $1 AND to_user = $2) OR (from_user = $3 AND to_user = $4))
      AND status = 'accepted'`,
      [viewerId, profileUserId, profileUserId, viewerId]
    );
    return rows.length > 0;
  }
}

module.exports = new InterestRepository();
