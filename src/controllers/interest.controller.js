const interestService = require("../services/interest.service");

class InterestController {
  async sendInterest(req, res, next) {
    try {
      const { to_user_id } = req.body;
      const result = await interestService.manageInterest(to_user_id, req.userId, "send");
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async manageInterest(req, res, next) {
    try {
      const { to_user_id, action, interest_id } = req.body;
      const result = await interestService.manageInterest(to_user_id, req.userId, action, interest_id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async rejectInterest(req, res, next) {
    try {
      const { interest_id } = req.body;
      const result = await interestService.manageInterest(null, req.userId, "reject", interest_id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getInterests(req, res, next) {
    try {
      const { type } = req.body;
      const result = await interestService.getInterests(req.userId, type || 0);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InterestController();
