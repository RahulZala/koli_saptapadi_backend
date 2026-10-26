const pool = require("../config/database");

class PrivacyRepository {
  constructor() {
    this.tableInitialized = false;
  }

  async ensureColumns() {
    if (this.tableInitialized) return;
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_status VARCHAR(50) DEFAULT 'active';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_privacy VARCHAR(50) DEFAULT 'public';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_visibility VARCHAR(50) DEFAULT 'on_accept';
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.warn("Notice ensuring privacy columns:", err.message);
    }
  }

  async getPrivacySettings(userId) {
    await this.ensureColumns();
    const [rows] = await pool.execute(
      "SELECT profile_status, photo_privacy, phone_visibility FROM users WHERE id = $1",
      [userId]
    );
    if (!rows || rows.length === 0) {
      return {
        profile_status: "active",
        photo_privacy: "public",
        phone_visibility: "on_accept"
      };
    }
    const r = rows[0];
    return {
      profile_status: r.profile_status || "active",
      photo_privacy: r.photo_privacy || "public",
      phone_visibility: r.phone_visibility || "on_accept"
    };
  }

  async updatePrivacySettings(userId, settings) {
    await this.ensureColumns();
    const { profile_status, photo_privacy, phone_visibility } = settings;

    const validStatus = ["active", "on_hold", "married"];
    const validPhoto = ["public", "blur", "request_only"];
    const validPhone = ["public", "on_accept", "request_only"];

    const statusVal = validStatus.includes(profile_status) ? profile_status : "active";
    const photoVal = validPhoto.includes(photo_privacy) ? photo_privacy : "public";
    const phoneVal = validPhone.includes(phone_visibility) ? phone_visibility : "on_accept";

    await pool.execute(
      `UPDATE users SET 
        profile_status = $1, 
        photo_privacy = $2, 
        phone_visibility = $3 
       WHERE id = $4`,
      [statusVal, photoVal, phoneVal, userId]
    );

    return {
      profile_status: statusVal,
      photo_privacy: photoVal,
      phone_visibility: phoneVal
    };
  }
}

module.exports = new PrivacyRepository();
