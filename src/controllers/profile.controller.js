const profileService = require("../services/profile.service");

class ProfileController {
  async getProfileData(req, res, next) {
    try {
      const { table } = req.body;
      const result = await profileService.getUserRow(req.userId, table || "users");
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMyProfile(req, res, next) {
    try {
      const { fcm_token } = req.body;
      const result = await profileService.getCompleteProfile(req.userId, fcm_token);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateBasicDetails(req, res, next) {
    try {
      const result = await profileService.updateBasicDetails(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async addFamilyDetails(req, res, next) {
    try {
      const result = await profileService.addFamilyDetails(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async addPhysicalDetails(req, res, next) {
    try {
      const result = await profileService.addPhysicalDetails(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async manageAddress(req, res, next) {
    try {
      const result = await profileService.addOrUpdateAddress(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async addMaritalDetails(req, res, next) {
    try {
      const result = await profileService.addMaritalProfessionalDetails(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async savePartnerPreferences(req, res, next) {
    try {
      const result = await profileService.savePartnerPreferences(req.userId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async viewProfile(req, res, next) {
    try {
      const { profile_user_id } = req.body;
      const result = await profileService.getPartnerProfile(req.userId, profile_user_id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProfileController();
