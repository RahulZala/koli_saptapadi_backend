const pool = require("../config/database");
const interestRepository = require("../repositories/interest.repository");
const notificationService = require("./notification.service");
const userRepository = require("../repositories/user.repository");

class InterestService {
  async manageInterest(toUserId, fromUserId, action, interestId = null) {
    const sub = await interestRepository.getActiveSubscription(fromUserId);
    if (!sub) {
      return { success: false, message: "Subscription required" };
    }

    if (["accept", "reject"].includes(action) && !interestId) {
      return { success: false, message: "Please share interest person" };
    }

    if (action === "send" || action === "accept") {
      // Record profile view
      await pool.execute(
        "INSERT INTO profile_views (user_id, viewed_user_id) VALUES ($1, $2)",
        [fromUserId, toUserId]
      );
    }

    if (action === "send") {
      const alreadySent = await interestRepository.checkExistingInterest(fromUserId, toUserId);
      if (alreadySent) {
        return { success: false, message: "Already sent" };
      }

      const consumeRes = await interestRepository.consumeProfileView(fromUserId);
      if (!consumeRes.success) {
        return { success: false, message: consumeRes.message };
      }

      const insertId = await interestRepository.sendInterest(fromUserId, toUserId);

      // Trigger Push & Save Notification
      const senderUser = await userRepository.findById(fromUserId);
      const userName = senderUser ? `${senderUser.first_name || ""} ${senderUser.last_name || ""}`.trim() : "User";

      await notificationService.createAndSendNotification(
        fromUserId,
        toUserId,
        "New Interest Received",
        `${userName} has shown interest in your profile`,
        "interest_send",
        insertId
      );

      return { success: true, message: "Interest sent successfully" };
    } else if (action === "accept") {
      const interest = await interestRepository.getInterestById(interestId, fromUserId);
      if (!interest || interest.status !== "pending") {
        return { success: false, message: "Invalid interest" };
      }

      await interestRepository.updateInterestStatus(interestId, "accepted");

      // Deduct interest view count from receiver
      await pool.execute(
        "UPDATE user_subscriptions SET remaining_interests = remaining_interests - 1 WHERE user_id = $1 AND remaining_interests > 0 AND is_active = 1",
        [toUserId]
      );

      const senderUser = await userRepository.findById(fromUserId);
      const userName = senderUser ? `${senderUser.first_name || ""} ${senderUser.last_name || ""}`.trim() : "User";

      await notificationService.createAndSendNotification(
        fromUserId,
        toUserId,
        "Interest Update",
        `Your interest was accepted by ${userName}`,
        "interest_accept",
        interestId
      );

      return { success: true, message: "Interest accepted successfully" };
    } else if (action === "reject") {
      const interest = await interestRepository.getInterestById(interestId, fromUserId);
      if (!interest || interest.status !== "pending") {
        return { success: false, message: "Invalid interest" };
      }

      await interestRepository.updateInterestStatus(interestId, "rejected");

      const senderUser = await userRepository.findById(fromUserId);
      const userName = senderUser ? `${senderUser.first_name || ""} ${senderUser.last_name || ""}`.trim() : "User";

      await notificationService.createAndSendNotification(
        fromUserId,
        toUserId,
        "Interest Update",
        `Your interest was rejected by ${userName}`,
        "interest_reject",
        interestId
      );

      return { success: true, message: "Interest rejected successfully" };
    }

    return { success: false, message: "Invalid action" };
  }

  async getInterests(userId, type) {
    const list = await interestRepository.getInterestsList(userId, parseInt(type, 10));
    const data = list.map((row) => ({
      ...row,
      name: `${row.first_name || ""} ${row.last_name || ""}`.trim()
    }));

    return {
      success: true,
      data: { profiles: data }
    };
  }
}

module.exports = new InterestService();
