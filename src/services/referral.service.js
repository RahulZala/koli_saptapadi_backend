const referralRepository = require("../repositories/referral.repository");

class ReferralService {
  async getReferralInfo(userId) {
    const summary = await referralRepository.getReferralSummary(userId);
    const referralCode = `KOLI${userId}`;
    const shareMessage = `Find your perfect life partner on Koli Saptapadi Matrimony! Use my referral code *${referralCode}* to get 3 free send interests upon joining: https://koli-saptapadi.vercel.app/`;

    return {
      success: 1,
      data: {
        referral_code: referralCode,
        bonus_send_interests_per_referral: 3,
        total_referrals: parseInt(summary.total_referrals || 0, 10),
        total_bonus_send_interests: parseInt(summary.total_bonus_credits || 0, 10),
        share_message: shareMessage
      }
    };
  }

  async applyReferral(userId, code) {
    return await referralRepository.applyReferralCode(userId, code);
  }

  async getAddons() {
    // Pricing remains unchanged: ₹199 and ₹499
    const addons = await referralRepository.getAddonPlans();
    return {
      success: 1,
      data: {
        addon_plans: addons
      }
    };
  }
}

module.exports = new ReferralService();
