const pool = require("../config/database");

class KundliRepository {
  async ensureTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kundli_details (
          id SERIAL PRIMARY KEY,
          user_id INT UNIQUE NOT NULL,
          birth_time VARCHAR(20),
          birth_place VARCHAR(100),
          rashi VARCHAR(50),
          nakshatra VARCHAR(50),
          gotra VARCHAR(50),
          kundli_photo_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err) {
      console.warn("Notice ensuring kundli_details table:", err.message);
    }
  }

  async getKundli(userId) {
    await this.ensureTable();
    const [rows] = await pool.execute(
      `SELECT kd.*, pd.manglik 
       FROM kundli_details kd
       LEFT JOIN physical_details pd ON pd.user_id = kd.user_id
       WHERE kd.user_id = $1`,
      [userId]
    );
    return rows[0] || null;
  }

  async saveKundli(userId, data) {
    await this.ensureTable();
    const { birth_time, birth_place, rashi, nakshatra, gotra, kundli_photo_url } = data;

    const [existing] = await pool.execute("SELECT id FROM kundli_details WHERE user_id = $1", [userId]);

    if (existing && existing.length > 0) {
      await pool.execute(
        `UPDATE kundli_details SET
          birth_time = $1, birth_place = $2, rashi = $3, nakshatra = $4, gotra = $5, 
          kundli_photo_url = COALESCE($6, kundli_photo_url), updated_at = NOW()
        WHERE user_id = $7`,
        [birth_time, birth_place, rashi, nakshatra, gotra, kundli_photo_url, userId]
      );
    } else {
      await pool.execute(
        `INSERT INTO kundli_details (user_id, birth_time, birth_place, rashi, nakshatra, gotra, kundli_photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, birth_time, birth_place, rashi, nakshatra, gotra, kundli_photo_url]
      );
    }
  }
}

module.exports = new KundliRepository();
