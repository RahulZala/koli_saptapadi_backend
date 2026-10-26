const shortlistService = require("../services/shortlist.service");

class ShortlistController {
  async toggleShortlist(req, res, next) {
    try {
      const targetUserId = req.body.profile_user_id || req.body.to_user_id || req.body.shortlist_user_id;
      const result = await shortlistService.toggleShortlist(req.userId, targetUserId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getShortlists(req, res, next) {
    try {
      const page = req.body.page || req.query.page || 1;
      const limit = req.body.limit || req.query.limit || 20;
      const result = await shortlistService.getShortlistedProfiles(req.userId, page, limit);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ShortlistController();
