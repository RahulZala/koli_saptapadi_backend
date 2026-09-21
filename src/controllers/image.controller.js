const cloudflareService = require("../services/cloudflare.service");
const profileService = require("../services/profile.service");

class ImageController {
  async getPhotoUploadUrl(req, res, next) {
    try {
      const { filename = null, mimeType = "image/jpeg" } = req.body;
      const result = await cloudflareService.getPresignedUploadUrl(
        req.userId,
        "user_photos",
        filename,
        mimeType
      );
      return res.status(200).json({
        success: 1,
        message: "Presigned photo upload URL generated successfully",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

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
      const userId = req.body.user_id || req.userId;
      const result = await profileService.getImages(userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ImageController();
