const pool = require("../config/database");

class SubscriptionRepository {
  async getPlans() {
    const [rows] = await pool.execute(
      "SELECT id, name, price, validity_days, profile_views FROM subscription_plans"
    );
    return rows;
  }

  async getPlanById(planId) {
    const [rows] = await pool.execute(
      "SELECT id, name, price, validity_days, profile_views FROM subscription_plans WHERE id = $1",
      [planId]
    );
    return rows[0] || null;
  }

  async createTrialSubscription(userId) {
    const [checkSub] = await pool.execute(
      "SELECT id FROM user_subscriptions WHERE user_id = $1",
      [userId]
    );

    if (checkSub.length === 0) {
      const startDate = new Date().toISOString().split("T")[0];
      const endDateObj = new Date();
      endDateObj.setDate(endDateObj.getDate() + 7);
      const endDate = endDateObj.toISOString().split("T")[0];

      await pool.execute(
        "INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, remaining_interests, is_active) VALUES ($1, 1, $2, $3, 5, 1)",
        [userId, startDate, endDate]
      );
    }
  }

  async createPendingOrder(userId, planId, planPrice, razorpayOrderId) {
    await pool.execute(
      "INSERT INTO subscription_payments (user_id, plan_id, amount, razorpay_order_id, status) VALUES ($1, $2, $3, $4, 'pending')",
      [userId, planId, planPrice, razorpayOrderId]
    );
  }

  async getPendingOrder(orderId, userId) {
    const [rows] = await pool.execute(
      "SELECT * FROM subscription_payments WHERE razorpay_order_id = $1 AND user_id = $2 AND status = 'pending'",
      [orderId, userId]
    );
    return rows[0] || null;
  }

  async updatePaymentSuccess(orderId, paymentId, paymentMethod, razorpayPaymentId) {
    await pool.execute(
      "UPDATE subscription_payments SET status = 'success', payment_id = $1, payment_method = $2, razorpay_payment_id = $3 WHERE razorpay_order_id = $4",
      [paymentMethod, paymentMethod, razorpayPaymentId, orderId]
    );
  }

  async cancelOrder(orderId, userId) {
    const [rows] = await pool.execute(
      "SELECT * FROM subscription_payments WHERE razorpay_order_id = $1 AND user_id = $2 AND status = 'pending'",
      [orderId, userId]
    );
    if (rows.length === 0) return false;

    await pool.execute(
      "UPDATE subscription_payments SET status = 'failed' WHERE razorpay_order_id = $1",
      [orderId]
    );
    return true;
  }

  async getPaymentHistory(userId) {
    const [rows] = await pool.execute(
      `SELECT 
        sp.id, sp.user_id, sp.amount, sp.payment_method, sp.payment_id, sp.status, sp.created_at, sp.razorpay_order_id, sp.razorpay_payment_id,
        p.name AS plan_name, p.validity_days, p.profile_views
      FROM subscription_payments sp
      INNER JOIN subscription_plans p ON p.id = sp.plan_id
      WHERE sp.user_id = $1
      ORDER BY sp.id DESC`,
      [userId]
    );
    return rows;
  }

  async activateOrExtendSubscription(userId, planId, validityDays, profileViews) {
    const [subRows] = await pool.execute(
      "SELECT * FROM user_subscriptions WHERE user_id = $1 AND is_active = 1 AND end_date >= CURRENT_DATE",
      [userId]
    );

    if (subRows.length > 0) {
      const activeSub = subRows[0];
      const today = new Date().toISOString().split("T")[0];
      const baseDateStr = activeSub.end_date > today ? activeSub.end_date : today;
      const baseDate = new Date(baseDateStr);
      baseDate.setDate(baseDate.getDate() + parseInt(validityDays, 10));
      const newEndDate = baseDate.toISOString().split("T")[0];
      const newProfileViews = activeSub.remaining_interests + parseInt(profileViews, 10);

      await pool.execute(
        "UPDATE user_subscriptions SET end_date = $1, remaining_interests = $2 WHERE id = $3",
        [newEndDate, newProfileViews, activeSub.id]
      );
    } else {
      const startDate = new Date().toISOString().split("T")[0];
      const endDateObj = new Date();
      endDateObj.setDate(endDateObj.getDate() + parseInt(validityDays, 10));
      const endDate = endDateObj.toISOString().split("T")[0];

      await pool.execute(
        "INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, remaining_interests, is_active) VALUES ($1, $2, $3, $4, $5, 1)",
        [userId, planId, startDate, endDate, profileViews]
      );
    }
  }
}

module.exports = new SubscriptionRepository();
