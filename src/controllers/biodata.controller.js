const biodataService = require("../services/biodata.service");

class BiodataController {
  async generateBiodata(req, res, next) {
    try {
      const targetUserId = req.body.profile_user_id || req.body.user_id || req.userId;
      const result = await biodataService.generateBiodata(req.userId, targetUserId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BiodataController();
