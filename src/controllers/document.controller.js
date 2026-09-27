const cloudflareService = require("../services/cloudflare.service");

class DocumentController {
  async uploadDocument(req, res, next) {
    try {
      const {
        profile_update,
        document_type,
        profile,
        front_side,
        back_side,
        flag
      } = req.body;

      const updateFlag = String(profile_update || flag || "").trim().toUpperCase();

      // Flag 'N': Only update profile picture (documents not required)
      if (updateFlag === "N" || (updateFlag === "" && profile && !front_side && !back_side)) {
        if (!profile) {
          return res.status(400).json({
            success: 0,
            message: "Profile photo is required when profile_update is 'N'"
          });
        }

        const result = await cloudflareService.uploadProfilePhotoOnly(
          req.userId,
          profile
        );
        return res.status(result.success === 1 ? 200 : 400).json(result);
      }

      // Flag 'Y' (or default with full document payload): Update document & profile picture
      const result = await cloudflareService.uploadDocuments(
        req.userId,
        document_type,
        profile,
        front_side,
        back_side
      );
      return res.status(result.success === 1 ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentController();
