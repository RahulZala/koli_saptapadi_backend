const cloudflareService = require("../services/cloudflare.service");

class DocumentController {
  async getUploadUrl(req, res, next) {
    try {
      const { folder = "documents", filename = null, mimeType = "image/jpeg" } = req.body;
      const result = await cloudflareService.getPresignedUploadUrl(
        req.userId,
        folder,
        filename,
        mimeType
      );
      return res.status(200).json({
        success: 1,
        message: "Presigned upload URL generated successfully",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getDocumentUploadUrls(req, res, next) {
    try {
      const result = await cloudflareService.getDocumentUploadUrls(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async uploadDocument(req, res, next) {
    try {
      const { document_type, profile, front_side, back_side, profile_url, front_url, back_url } = req.body;
      const result = await cloudflareService.uploadDocuments(
        req.userId,
        document_type,
        profile || profile_url,
        front_side || front_url,
        back_side || back_url
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentController();
