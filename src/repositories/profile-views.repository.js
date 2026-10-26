const pool = require("../config/database");

class ProfileViewsRepository {
  async ensureTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS profile_views (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          viewed_user_id INT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_profile_views_target ON profile_views(viewed_user_id);
      `);
    } catch (err) {
      console.warn("Notice ensuring profile_views table:", err.message);
    }
  }

  async recordView(viewerId, viewedUserId) {
    await this.ensureTable();
    if (!viewerId || !viewedUserId || viewerId === viewedUserId) return;
    try {
      await pool.execute(
        "INSERT INTO profile_views (user_id, viewed_user_id) VALUES ($1, $2)",
        [viewerId, viewedUserId]
      );
    } catch (err) {
      console.warn("Notice recording profile view:", err.message);
    }
  }

  async getViewersList(viewedUserId, page = 1, limit = 20) {
    await this.ensureTable();
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute(
      "SELECT COUNT(DISTINCT user_id) AS total_views FROM profile_views WHERE viewed_user_id = $1",
      [viewedUserId]
    );
    const totalViews = parseInt(countRows[0]?.total_views || 0, 10);

    const sql = `
      SELECT DISTINCT ON (pv.user_id)
        pv.user_id, pv.created_at AS viewed_at,
        u.first_name, u.last_name, u.sub_caste, u.dob,
        mp.occupation, mp.work_city,
        up.profile, u.is_verified
      FROM profile_views pv
      INNER JOIN users u ON u.id = pv.user_id
      LEFT JOIN marital_professional_details mp ON mp.user_id = u.id
      LEFT JOIN user_document up ON up.user_id = u.id
      WHERE pv.viewed_user_id = $1
      ORDER BY pv.user_id, pv.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [rows] = await pool.execute(sql, [viewedUserId, limit, offset]);

    return {
      total_views: totalViews,
      page,
      limit,
      viewers: rows || []
    };
  }
}

module.exports = new ProfileViewsRepository();
