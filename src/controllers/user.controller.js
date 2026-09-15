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
      const { to_user_id, reason } = req.body;
      const result = await userService.reportUser(req.userId, to_user_id, reason);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
