const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/upload_document", authenticateUser, documentController.uploadDocument);

module.exports = router;
