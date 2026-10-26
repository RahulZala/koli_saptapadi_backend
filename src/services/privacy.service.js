const privacyRepository = require("../repositories/privacy.repository");

class PrivacyService {
  async getPrivacySettings(userId) {
    const settings = await privacyRepository.getPrivacySettings(userId);
    return {
      success: 1,
      data: settings
    };
  }

  async updatePrivacySettings(userId, data) {
    const updated = await privacyRepository.updatePrivacySettings(userId, data);
    return {
      success: 1,
      message: "Privacy settings updated successfully",
      data: updated
    };
  }
}

module.exports = new PrivacyService();
