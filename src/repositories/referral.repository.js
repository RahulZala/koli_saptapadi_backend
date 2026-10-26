const pool = require("../config/database");

class ReferralRepository {
  async ensureTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_referrals (
          id SERIAL PRIMARY KEY,
          referrer_id INT NOT NULL,
          referred_id INT UNIQUE NOT NULL,
          referral_code VARCHAR(50) NOT NULL,
          bonus_credits INT DEFAULT 3,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON user_referrals(referrer_id);
      `);
    } catch (err) {
      console.warn("Notice ensuring user_referrals table:", err.message);
    }
  }

  async getReferralSummary(userId) {
    await this.ensureTable();
    try {
      const [rows] = await pool.execute(
        "SELECT COUNT(*) AS total_referrals, COALESCE(SUM(bonus_credits), 0) AS total_bonus_credits FROM user_referrals WHERE referrer_id = $1",
        [userId]
      );
      return rows[0] || { total_referrals: 0, total_bonus_credits: 0 };
    } catch (err) {
      console.warn("Notice querying referral summary:", err.message);
      return { total_referrals: 0, total_bonus_credits: 0 };
    }
  }

  async addSendInterests(userId, count = 3) {
    try {
      // Check if user has an active subscription
      const [rows] = await pool.execute(
        "SELECT id, remaining_interests FROM user_subscriptions WHERE user_id = $1 AND is_active = 1 AND end_date >= CURRENT_DATE ORDER BY id DESC LIMIT 1",
        [userId]
      );

      if (rows && rows.length > 0) {
        // Increment send interest count by 3
        await pool.execute(
          "UPDATE user_subscriptions SET remaining_interests = remaining_interests + $1 WHERE id = $2",
          [count, rows[0].id]
        );
      } else {
        // User has no active subscription: create/activate one with 3 send interests valid for 30 days
        const startDate = new Date().toISOString().split("T")[0];
        const endDateObj = new Date();
        endDateObj.setDate(endDateObj.getDate() + 30);
        const endDate = endDateObj.toISOString().split("T")[0];

        await pool.execute(
          "INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, remaining_interests, is_active) VALUES ($1, 1, $2, $3, $4, 1)",
          [userId, startDate, endDate, count]
        );
      }
    } catch (err) {
      console.warn(`Notice adding send interests for user ${userId}:`, err.message);
    }
  }

  async applyReferralCode(referredUserId, referralCode) {
    await this.ensureTable();
    // Parse referral code format: KOLI<userId>
    const match = String(referralCode).trim().toUpperCase().match(/^KOLI(\d+)$/);
    if (!match) {
      return { success: 0, message: "Invalid referral code format" };
    }

    const referrerId = parseInt(match[1], 10);
    if (referrerId === referredUserId) {
      return { success: 0, message: "You cannot use your own referral code" };
    }

    try {
      const [referrerExists] = await pool.execute("SELECT id FROM users WHERE id = $1", [referrerId]);
      if (!referrerExists || referrerExists.length === 0) {
        return { success: 0, message: "Referral code not found" };
      }

      const [alreadyClaimed] = await pool.execute("SELECT id FROM user_referrals WHERE referred_id = $1", [referredUserId]);
      if (alreadyClaimed && alreadyClaimed.length > 0) {
        return { success: 0, message: "You have already claimed a referral bonus" };
      }

      // Record successful referral record
      await pool.execute(
        "INSERT INTO user_referrals (referrer_id, referred_id, referral_code, bonus_credits) VALUES ($1, $2, $3, 3)",
        [referrerId, referredUserId, referralCode.toUpperCase()]
      );

      // Award exactly 3 send interests to BOTH sides successfully
      await this.addSendInterests(referrerId, 3);
      await this.addSendInterests(referredUserId, 3);

      return {
        success: 1,
        message: "Referral applied! 3 send interests successfully added to both your account and the referrer's account.",
        bonus_credits: 3,
        bonus_send_interests: 3
      };
    } catch (err) {
      console.warn("Notice applying referral code:", err.message);
      return { success: 0, message: "Database temporarily unavailable" };
    }
  }

  async getAddonPlans() {
    // Pricing remains unchanged as specified: ₹199 and ₹499
    return [
      {
        id: "addon_5",
        name: "Quick Connect (5 Contacts)",
        price: 199,
        type: "addon",
        profile_views: 5,
        description: "Unlock 5 verified contact numbers without changing your plan."
      },
      {
        id: "addon_15",
        name: "Prime Booster (15 Contacts)",
        price: 499,
        type: "addon",
        profile_views: 15,
        description: "Unlock 15 verified contact numbers + direct WhatsApp chat."
      }
    ];
  }
}

module.exports = new ReferralRepository();
