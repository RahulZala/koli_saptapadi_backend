const pool = require("../config/database");
const blockRepository = require("./block.repository");

class InterestRepository {
  constructor() {
    this.schemaReady = null;
  }

  async ensureRequestSchema() {
    if (!this.schemaReady) {
      this.schemaReady = pool.query(`
        ALTER TABLE interests ADD COLUMN IF NOT EXISTS response_at TIMESTAMP WITH TIME ZONE;
        CREATE INDEX IF NOT EXISTS idx_interests_pair_status
          ON interests(from_user, to_user, status);
      `).catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    }
    await this.schemaReady;
  }

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

  async getPairRequests(userId, partnerId) {
    await this.ensureRequestSchema();
    const [rows] = await pool.execute(
      `SELECT id, from_user, to_user, status, created_at, response_at
       FROM interests
       WHERE (from_user = $1 AND to_user = $2)
          OR (from_user = $2 AND to_user = $1)
       ORDER BY CASE status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                created_at DESC, id DESC`,
      [userId, partnerId]
    );
    return rows;
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
    await this.ensureRequestSchema();
    await blockRepository.ensureTable();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock($1::integer, $2::integer)",
        [Math.min(fromUser, toUser), Math.max(fromUser, toUser)]
      );

      const blocked = await client.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [fromUser, toUser]
      );
      if (blocked.rows && blocked.rows.length > 0) {
        await client.query("ROLLBACK");
        return { error: "This profile is unavailable" };
      }
      const recipient = await client.query(
        `SELECT id FROM users
         WHERE id = $1 AND is_active = true
           AND COALESCE(profile_status, 'active') = 'active'`,
        [toUser]
      );
      if (!recipient.rows || recipient.rows.length === 0) {
        await client.query("ROLLBACK");
        return { error: "This profile is unavailable" };
      }

      const existing = await client.query(
        `SELECT id, from_user, to_user, status
         FROM interests
         WHERE (from_user = $1 AND to_user = $2)
            OR (from_user = $2 AND to_user = $1)
         ORDER BY CASE status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                  created_at DESC, id DESC
         FOR UPDATE`,
        [fromUser, toUser]
      );
      const pairRows = existing.rows || [];
      if (pairRows.some((row) => row.status === "accepted")) {
        await client.query("ROLLBACK");
        return { error: "This profile is already connected" };
      }
      if (pairRows.some((row) => row.status === "pending")) {
        await client.query("ROLLBACK");
        return { error: "A request is already pending between you and this profile" };
      }
      if (pairRows.some((row) => row.from_user === fromUser && row.status === "rejected")) {
        await client.query("ROLLBACK");
        return { error: "You cannot send another request to this profile" };
      }

      const subscription = await client.query(
        `UPDATE user_subscriptions
         SET remaining_interests = remaining_interests - 1
         WHERE user_id = $1 AND is_active = 1 AND end_date >= CURRENT_DATE
           AND remaining_interests > 0
         RETURNING id`,
        [fromUser]
      );
      if (!subscription.rows || subscription.rows.length === 0) {
        await client.query("ROLLBACK");
        return { error: "Subscription required or interest limit exceeded" };
      }

      const inserted = await client.query(
        `INSERT INTO interests (from_user, to_user, status, created_at)
         VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
         RETURNING id, from_user, to_user, status, created_at`,
        [fromUser, toUser]
      );
      await client.query("COMMIT");
      return inserted.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getInterestById(interestId, toUser) {
    const [rows] = await pool.execute(
      "SELECT id, from_user, status FROM interests WHERE id = $1 AND to_user = $2",
      [interestId, toUser]
    );
    return rows[0] || null;
  }

  async updateInterestStatus(interestId, status) {
    await this.ensureRequestSchema();
    const [rows] = await pool.execute(
      `UPDATE interests
       SET status = $1, response_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'pending'
       RETURNING id, from_user, to_user, status, response_at`,
      [status, interestId]
    );
    return rows[0] || null;
  }

  async respondToInterest(interestId, receiverId, status) {
    await this.ensureRequestSchema();
    await blockRepository.ensureTable();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const candidate = await client.query(
        `SELECT from_user, to_user
         FROM interests WHERE id = $1 AND to_user = $2 AND status = 'pending'`,
        [interestId, receiverId]
      );
      if (!candidate.rows || candidate.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const senderId = candidate.rows[0].from_user;
      await client.query(
        "SELECT pg_advisory_xact_lock($1::integer, $2::integer)",
        [Math.min(receiverId, senderId), Math.max(receiverId, senderId)]
      );
      const blocked = await client.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [receiverId, senderId]
      );
      if (blocked.rows && blocked.rows.length > 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const updated = await client.query(
        `UPDATE interests SET status = $1, response_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND to_user = $3 AND status = 'pending'
         RETURNING id, from_user, to_user, status, response_at`,
        [status, interestId, receiverId]
      );
      await client.query(updated.rows.length > 0 ? "COMMIT" : "ROLLBACK");
      return updated.rows[0] || null;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async cancelInterest(interestId, senderId) {
    await this.ensureRequestSchema();
    const [rows] = await pool.execute(
      `DELETE FROM interests
       WHERE id = $1 AND from_user = $2 AND status = 'pending'
       RETURNING id, from_user, to_user`,
      [interestId, senderId]
    );
    return rows[0] || null;
  }

  async getInterestsList(userId, type) {
    await blockRepository.ensureTable();
    let query = "";
    if (type === 0) {
      // Received interests
      query = `
        SELECT 
          i.id AS interest_id, i.status, i.created_at, i.response_at,
          u.id AS from_user_id, u.first_name, u.last_name,
          CASE WHEN COALESCE(u.photo_privacy, 'public') = 'public' OR i.status = 'accepted'
               THEN ud.profile ELSE NULL END AS profile
        FROM interests i
        INNER JOIN users u ON u.id = i.from_user
        LEFT JOIN user_document ud ON ud.user_id = i.from_user
        WHERE i.to_user = $1
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks b
            WHERE (b.blocker_id = i.from_user AND b.blocked_id = $1)
               OR (b.blocker_id = $1 AND b.blocked_id = i.from_user)
          )
        ORDER BY i.id DESC
      `;
    } else {
      // Sent interests
      query = `
        SELECT 
          i.id AS interest_id, i.status, i.created_at, i.response_at,
          u.id AS to_user_id, u.first_name, u.last_name,
          CASE WHEN COALESCE(u.photo_privacy, 'public') = 'public' OR i.status = 'accepted'
               THEN ud.profile ELSE NULL END AS profile
        FROM interests i
        INNER JOIN users u ON u.id = i.to_user
        LEFT JOIN user_document ud ON ud.user_id = i.to_user
        WHERE i.from_user = $1
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks b
            WHERE (b.blocker_id = i.to_user AND b.blocked_id = $1)
               OR (b.blocker_id = $1 AND b.blocked_id = i.to_user)
          )
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
