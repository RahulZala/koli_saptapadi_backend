const privacyService = require("../services/privacy.service");

class PrivacyController {
  async getSettings(req, res, next) {
    try {
      const result = await privacyService.getPrivacySettings(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const result = await privacyService.updatePrivacySettings(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PrivacyController();
