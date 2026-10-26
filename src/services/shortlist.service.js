const shortlistRepository = require("../repositories/shortlist.repository");

class ShortlistService {
  async toggleShortlist(userId, targetUserId) {
    if (!targetUserId || parseInt(targetUserId, 10) <= 0) {
      return { success: 0, message: "Target user ID is required" };
    }
    if (parseInt(userId, 10) === parseInt(targetUserId, 10)) {
      return { success: 0, message: "Cannot shortlist your own profile" };
    }

    const result = await shortlistRepository.toggleShortlist(userId, parseInt(targetUserId, 10));
    return {
      success: 1,
      message: result.is_shortlisted ? "Profile added to shortlist" : "Profile removed from shortlist",
      data: result
    };
  }

  async getShortlistedProfiles(userId, page = 1, limit = 20) {
    const data = await shortlistRepository.getShortlistedProfiles(userId, page, limit);
    return {
      success: 1,
      data
    };
  }
}

module.exports = new ShortlistService();
