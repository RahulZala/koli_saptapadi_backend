const referralService = require("../services/referral.service");

class ReferralController {
  async getInfo(req, res, next) {
    try {
      const result = await referralService.getReferralInfo(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async apply(req, res, next) {
    try {
      const { referral_code } = req.body;
      const result = await referralService.applyReferral(req.userId, referral_code);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getAddons(req, res, next) {
    try {
      const result = await referralService.getAddons();
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReferralController();
