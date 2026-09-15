const pool = require("../config/database");

class UserRepository {
  async findByEmail(email) {
    const [rows] = await pool.execute(
      "SELECT id, first_name, last_name, email, password, is_active FROM users WHERE email = $1",
      [email]
    );
    return rows[0] || null;
  }

  async findByPhone(phone) {
    const [rows] = await pool.execute(
      "SELECT id, is_active FROM users WHERE phone = $1",
      [phone]
    );
    return rows[0] || null;
  }

  async findById(id) {
    const [rows] = await pool.execute(
      "SELECT id, first_name, last_name, phone, is_verified, is_active, fcm_token, api_token FROM users WHERE id = $1",
      [id]
    );
    return rows[0] || null;
  }

  async createOTP(phone, otp, expiresAt) {
    const [rows] = await pool.execute(
      "INSERT INTO user_otps (phone, otp, expires_at) VALUES ($1, $2, $3) RETURNING id",
      [phone, otp, expiresAt]
    );
    return rows[0] ? rows[0].id : null;
  }

  async findLatestOTP(phone, otp) {
    const [rows] = await pool.execute(
      "SELECT id, expires_at FROM user_otps WHERE phone = $1 AND otp = $2 AND is_used = 0 ORDER BY id DESC LIMIT 1",
      [phone, otp]
    );
    return rows[0] || null;
  }

  async markOTPUsed(otpId) {
    await pool.execute(
      "UPDATE user_otps SET is_used = 1 WHERE id = $1",
      [otpId]
    );
  }

  async createUserFromPhone(phone) {
    const [rows] = await pool.execute(
      "INSERT INTO users (phone, is_verified) VALUES ($1, 1) RETURNING id",
      [phone]
    );
    return rows[0] ? rows[0].id : null;
  }

  async updateTokenAndVerify(userId, token) {
    await pool.execute(
      "UPDATE users SET api_token = $1, is_verified = 1 WHERE id = $2",
      [token, userId]
    );
  }

  async updateFCMToken(userId, fcmToken) {
    await pool.execute(
      "UPDATE users SET fcm_token = $1 WHERE id = $2",
      [fcmToken, userId]
    );
  }

  async clearTokens(userId) {
    await pool.execute(
      "UPDATE users SET fcm_token = NULL, api_token = NULL WHERE id = $1",
      [userId]
    );
  }

  async deactivateUser(userId) {
    await pool.execute(
      "UPDATE users SET is_active = 0, fcm_token = NULL, api_token = NULL WHERE id = $1",
      [userId]
    );
  }

  async getReportsCount(fromUserId, toUserId) {
    const [rows] = await pool.execute(
      "SELECT COUNT(*)::int as total FROM user_reports WHERE from_user_id = $1 AND to_user_id = $2",
      [fromUserId, toUserId]
    );
    return rows[0] ? parseInt(rows[0].total, 10) : 0;
  }

  async createReport(fromUserId, toUserId, reason) {
    await pool.execute(
      "INSERT INTO user_reports (from_user_id, to_user_id, reason) VALUES ($1, $2, $3)",
      [fromUserId, toUserId, reason]
    );
  }

  async getTotalReportsAgainstUser(toUserId) {
    const [rows] = await pool.execute(
      "SELECT COUNT(*)::int as total FROM user_reports WHERE to_user_id = $1",
      [toUserId]
    );
    return rows[0] ? parseInt(rows[0].total, 10) : 0;
  }
}

module.exports = new UserRepository();
