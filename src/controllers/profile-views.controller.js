const profileViewsService = require("../services/profile-views.service");

class ProfileViewsController {
  async getViewers(req, res, next) {
    try {
      const page = req.body.page || req.query.page || 1;
      const limit = req.body.limit || req.query.limit || 20;
      const result = await profileViewsService.getViewers(req.userId, page, limit);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProfileViewsController();
