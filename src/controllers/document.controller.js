const cloudflareService = require("../services/cloudflare.service");

class DocumentController {
  async uploadDocument(req, res, next) {
    try {
      const { document_type, profile, front_side, back_side } = req.body;
      const result = await cloudflareService.uploadDocuments(
        req.userId,
        document_type,
        profile,
        front_side,
        back_side
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentController();
