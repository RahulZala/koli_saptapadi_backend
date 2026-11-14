const userService = require("../services/user.service");

class UserController {
  async getDashboard(req, res, next) {
    try {
      const { page, limit, ...filters } = req.body;
      const result = await userService.getDashboardProfiles(req.userId, filters, page, limit);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async reportUser(req, res, next) {
    try {
      const toUserId = req.body.to_user_id || req.body.profile_user_id || req.body.partner_id;
      const reasonText = req.body.reason || req.body.Reason || "Reported by user";
      const result = await userService.reportUser(req.userId, toUserId, reasonText);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
