const subscriptionRepository = require("../repositories/subscription.repository");
const razorpayService = require("./razorpay.service");

class SubscriptionService {
  async getPlans() {
    const plans = await subscriptionRepository.getPlans();
    return { success: 1, data: plans };
  }

  async createOrder(userId, planId) {
    if (!planId) {
      return { success: 0, message: "Invalid plan" };
    }
    return await razorpayService.createOrder(userId, planId);
  }

  async subscribePlan(userId, orderId, paymentId) {
    if (!orderId || !paymentId) {
      return { success: 0, message: "Order ID and Payment ID required" };
    }
    return await razorpayService.verifyAndSubscribe(userId, orderId, paymentId);
  }

  async cancelOrder(userId, orderId) {
    if (!orderId || !userId) {
      return { success: 0, message: "Please provide order_id and user_id" };
    }
    const cancelled = await subscriptionRepository.cancelOrder(orderId, userId);
    if (!cancelled) {
      return { success: 0, message: "Invalid order" };
    }
    return { success: 1, message: "Order cancelled" };
  }

  async getPaymentHistory(userId) {
    const data = await subscriptionRepository.getPaymentHistory(userId);
    return { success: 1, data };
  }
}

module.exports = new SubscriptionService();
