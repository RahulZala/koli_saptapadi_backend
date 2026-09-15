const Razorpay = require("razorpay");
const env = require("../config/env");
const subscriptionRepository = require("../repositories/subscription.repository");

class RazorpayService {
  getInstance() {
    return new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
  }

  async createOrder(userId, planId) {
    const plan = await subscriptionRepository.getPlanById(planId);
    if (!plan) {
      return { success: false, message: "Invalid plan" };
    }

    const planPrice = parseFloat(plan.price);
    const amountInPaise = Math.round(planPrice * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `user_${userId}_plan_${planId}_${Date.now()}`
    };

    try {
      const instance = this.getInstance();
      const order = await instance.orders.create(options);
      await subscriptionRepository.createPendingOrder(userId, planId, planPrice, order.id);

      return {
        success: true,
        data: {
          order_id: order.id,
          amount: amountInPaise,
          payment_id: env.RAZORPAY_KEY_ID,
          mode: env.RAZORPAY_IS_LIVE === 1 ? "live" : "test"
        }
      };
    } catch (err) {
      console.error("Razorpay Order Creation Error:", err);
      return { success: false, message: "Failed to create order" };
    }
  }

  async verifyAndSubscribe(userId, orderId, paymentId) {
    const order = await subscriptionRepository.getPendingOrder(orderId, userId);
    if (!order) {
      return { success: false, message: "Invalid order" };
    }

    const plan = await subscriptionRepository.getPlanById(order.plan_id);
    if (!plan) {
      return { success: false, message: "Invalid plan" };
    }

    let paymentMethod = "upi";
    try {
      const instance = this.getInstance();
      const paymentDetails = await instance.payments.fetch(paymentId);
      paymentMethod = paymentDetails.method || "card";
    } catch (e) {
      console.warn("Could not fetch Razorpay payment details:", e.message);
    }

    await subscriptionRepository.updatePaymentSuccess(orderId, paymentId, paymentMethod, paymentId);
    await subscriptionRepository.activateOrExtendSubscription(userId, plan.id, plan.validity_days, plan.profile_views);

    return { success: true, message: "Subscribed successfully" };
  }
}

module.exports = new RazorpayService();
