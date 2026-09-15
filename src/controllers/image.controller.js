const cloudinaryService = require("../services/cloudinary.service");
const profileService = require("../services/profile.service");

class ImageController {
  async manageImage(req, res, next) {
    try {
      const { existing_images, new_images } = req.body;
      const result = await cloudinaryService.managePhotos(req.userId, existing_images, new_images);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getImage(req, res, next) {
    try {
      const userId = req.body.user_id || req.userId;
      const result = await profileService.getImages(userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ImageController();
