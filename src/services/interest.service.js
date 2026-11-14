const interestRepository = require("../repositories/interest.repository");
const blockRepository = require("../repositories/block.repository");
const privacyRepository = require("../repositories/privacy.repository");
const notificationService = require("./notification.service");
const userRepository = require("../repositories/user.repository");
const { timeAgo } = require("../utils/dates");

class InterestService {
  async manageInterest(toUserId, fromUserId, action, interestId = null) {
    if (toUserId && await blockRepository.isBlockedBetween(fromUserId, toUserId)) {
      return { success: 0, message: "This profile is unavailable" };
    }

    if (action === "send") {
      const receiverId = parseInt(toUserId, 10);
      if (!receiverId || receiverId <= 0 || receiverId === parseInt(fromUserId, 10)) {
        return { success: 0, message: "A valid different profile is required" };
      }

      await privacyRepository.ensureColumns();
      const request = await interestRepository.sendInterest(fromUserId, receiverId);
      if (!request || request.error) {
        return { success: 0, message: request?.error || "Could not send request" };
      }

      const senderUser = await userRepository.findById(fromUserId);
      const userName = senderUser ? `${senderUser.first_name || ""} ${senderUser.last_name || ""}`.trim() : "User";

      try {
        await notificationService.createAndSendNotification(
          fromUserId,
          receiverId,
          "New Profile Request",
          `${userName} has sent you a profile request`,
          "interest_send",
          request.id
        );
      } catch (err) {
        console.warn("Notice sending profile request notification:", err.message);
      }

      return {
        success: 1,
        message: "Profile request sent successfully",
        data: { interest_id: request.id, status: "pending" }
      };
    }

    if (action === "cancel") {
      if (!interestId) return { success: 0, message: "Request ID is required" };
      const cancelled = await interestRepository.cancelInterest(interestId, fromUserId);
      if (!cancelled) {
        return { success: 0, message: "Only your pending request can be cancelled" };
      }
      return {
        success: 1,
        message: "Profile request cancelled",
        data: { interest_id: cancelled.id, status: "cancelled" }
      };
    }

    if (action === "accept" || action === "reject") {
      if (!interestId) return { success: 0, message: "Request ID is required" };
      const status = action === "accept" ? "accepted" : "rejected";
      const updated = await interestRepository.respondToInterest(interestId, fromUserId, status);
      if (!updated) {
        return { success: 0, message: "Only the recipient can respond to a pending request" };
      }

      const receiverUser = await userRepository.findById(fromUserId);
      const userName = receiverUser
        ? `${receiverUser.first_name || ""} ${receiverUser.last_name || ""}`.trim()
        : "User";
      try {
        await notificationService.createAndSendNotification(
          fromUserId,
          updated.from_user,
          action === "accept" ? "Profile Request Accepted" : "Profile Request Declined",
          `${userName} ${action === "accept" ? "accepted" : "declined"} your profile request`,
          action === "accept" ? "interest_accept" : "interest_reject",
          updated.id
        );
      } catch (err) {
        console.warn("Notice sending profile request response notification:", err.message);
      }

      return {
        success: 1,
        message: action === "accept" ? "Profile request accepted" : "Profile request declined",
        data: { interest_id: updated.id, status: updated.status }
      };
    }

    return { success: 0, message: "Invalid action" };
  }

  async getInterests(userId, type) {
    await blockRepository.ensureTable();
    await privacyRepository.ensureColumns();
    const list = await interestRepository.getInterestsList(userId, parseInt(type, 10));
    const data = list.map((row) => ({
      ...row,
      name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
      timestamp: timeAgo(row.created_at)
    }));

    return {
      success: 1,
      data: { profiles: data }
    };
  }
}

module.exports = new InterestService();
