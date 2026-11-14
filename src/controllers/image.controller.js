const cloudflareService = require("../services/cloudflare.service");
const profileService = require("../services/profile.service");

class ImageController {
  async manageImage(req, res, next) {
    try {
      const { existing_images, new_images } = req.body;
      const result = await cloudflareService.managePhotos(req.userId, existing_images, new_images);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getImage(req, res, next) {
    try {
      const profileUserId = req.body.user_id || req.userId;
      const result = await profileService.getImages(req.userId, profileUserId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ImageController();
