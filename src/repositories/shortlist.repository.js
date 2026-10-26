const pool = require("../config/database");

class ShortlistRepository {
  constructor() {
    this.tableInitialized = false;
  }

  async ensureTable() {
    if (this.tableInitialized) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_shortlists (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          shortlisted_user_id INT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_user_shortlist UNIQUE (user_id, shortlisted_user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_shortlist_user ON user_shortlists(user_id);
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.warn("Notice ensuring user_shortlists table:", err.message);
    }
  }

  async toggleShortlist(userId, targetUserId) {
    await this.ensureTable();
    const [existing] = await pool.execute(
      "SELECT id FROM user_shortlists WHERE user_id = $1 AND shortlisted_user_id = $2",
      [userId, targetUserId]
    );

    if (existing && existing.length > 0) {
      await pool.execute(
        "DELETE FROM user_shortlists WHERE user_id = $1 AND shortlisted_user_id = $2",
        [userId, targetUserId]
      );
      return { is_shortlisted: false, action: "removed" };
    } else {
      await pool.execute(
        "INSERT INTO user_shortlists (user_id, shortlisted_user_id) VALUES ($1, $2)",
        [userId, targetUserId]
      );
      return { is_shortlisted: true, action: "added" };
    }
  }

  async isShortlisted(userId, targetUserId) {
    await this.ensureTable();
    const [rows] = await pool.execute(
      "SELECT id FROM user_shortlists WHERE user_id = $1 AND shortlisted_user_id = $2 LIMIT 1",
      [userId, targetUserId]
    );
    return rows && rows.length > 0;
  }

  async getShortlistedIds(userId) {
    await this.ensureTable();
    const [rows] = await pool.execute(
      "SELECT shortlisted_user_id FROM user_shortlists WHERE user_id = $1",
      [userId]
    );
    return (rows || []).map((r) => r.shortlisted_user_id);
  }

  async getShortlistedProfiles(userId, page = 1, limit = 20) {
    await this.ensureTable();
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.sub_caste, u.dob,
        pd.height, pd.weight, pd.marital_status,
        mp.occupation, mp.work_city,
        up.profile, u.is_verified,
        s.created_at AS shortlisted_at
      FROM user_shortlists s
      INNER JOIN users u ON u.id = s.shortlisted_user_id
      LEFT JOIN physical_details pd ON pd.user_id = u.id
      LEFT JOIN marital_professional_details mp ON mp.user_id = u.id
      LEFT JOIN user_document up ON up.user_id = u.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [rows] = await pool.execute(sql, [userId, limit, offset]);

    const profiles = (rows || []).map((row) => {
      let age = null;
      if (row.dob) {
        const dobDate = new Date(row.dob);
        const today = new Date();
        age = today.getFullYear() - dobDate.getFullYear();
      }
      delete row.dob;
      return { ...row, age, is_shortlisted: true };
    });

    return {
      page,
      limit,
      total: profiles.length,
      profiles
    };
  }
}

module.exports = new ShortlistRepository();
