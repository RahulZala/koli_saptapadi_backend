const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/upload_document", "/calls/upload_document"], authenticateUser, documentController.uploadDocument);
router.post(["/get_upload_url", "/calls/get_upload_url"], authenticateUser, documentController.getUploadUrl);
router.post(["/get_document_upload_urls", "/calls/get_document_upload_urls"], authenticateUser, documentController.getDocumentUploadUrls);

module.exports = router;
