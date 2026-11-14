const pool = require("../config/database");
const blockRepository = require("./block.repository");
const privacyRepository = require("./privacy.repository");

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
    await blockRepository.ensureTable();
    await privacyRepository.ensureColumns();
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute(
      `SELECT COUNT(DISTINCT pv.user_id) AS total_views
       FROM profile_views pv
       WHERE pv.viewed_user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = pv.user_id)
              OR (b.blocker_id = pv.user_id AND b.blocked_id = $1)
         )`,
      [viewedUserId]
    );
    const totalViews = parseInt(countRows[0]?.total_views || 0, 10);

    const sql = `
      SELECT DISTINCT ON (pv.user_id)
        pv.user_id, pv.created_at AS viewed_at,
        u.first_name, u.last_name, u.sub_caste, u.dob,
        mp.occupation, mp.work_city,
        CASE
          WHEN COALESCE(u.photo_privacy, 'public') = 'public'
            OR EXISTS (
              SELECT 1 FROM interests i
              WHERE i.status = 'accepted'
                AND ((i.from_user = pv.user_id AND i.to_user = $1)
                  OR (i.from_user = $1 AND i.to_user = pv.user_id))
            )
          THEN up.profile ELSE NULL
        END AS profile,
        u.is_verified
      FROM profile_views pv
      INNER JOIN users u ON u.id = pv.user_id
      LEFT JOIN marital_professional_details mp ON mp.user_id = u.id
      LEFT JOIN user_document up ON up.user_id = u.id
      WHERE pv.viewed_user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = $1 AND b.blocked_id = pv.user_id)
             OR (b.blocker_id = pv.user_id AND b.blocked_id = $1)
        )
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
