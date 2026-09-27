const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(
  ["/upload_document", "/calls/upload_document", "/manage_document", "/update_profile_pic"],
  authenticateUser,
  documentController.uploadDocument
);

module.exports = router;
