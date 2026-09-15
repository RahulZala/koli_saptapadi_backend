const subscriptionService = require("../services/subscription.service");

class SubscriptionController {
  async getPlans(req, res, next) {
    try {
      const result = await subscriptionService.getPlans();
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async createOrder(req, res, next) {
    try {
      const { plan_id } = req.body;
      const result = await subscriptionService.createOrder(req.userId, plan_id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async subscribePlan(req, res, next) {
    try {
      const { order_id, payment_id } = req.body;
      const result = await subscriptionService.subscribePlan(req.userId, order_id, payment_id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const { order_id } = req.body;
      const result = await subscriptionService.cancelOrder(req.userId, order_id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getPaymentHistory(req, res, next) {
    try {
      const result = await subscriptionService.getPaymentHistory(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SubscriptionController();
