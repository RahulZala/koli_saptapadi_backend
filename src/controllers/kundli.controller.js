const kundliService = require("../services/kundli.service");

class KundliController {
  async getKundli(req, res, next) {
    try {
      const targetUserId = req.body.profile_user_id || req.body.user_id || req.userId;
      const result = await kundliService.getKundli(req.userId, targetUserId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async saveKundli(req, res, next) {
    try {
      const result = await kundliService.saveKundli(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new KundliController();
