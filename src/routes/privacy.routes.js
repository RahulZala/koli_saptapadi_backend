const express = require("express");
const router = express.Router();
const privacyController = require("../controllers/privacy.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/get_privacy_settings", "/calls/get_privacy_settings"], authenticateUser, privacyController.getSettings);
router.post(["/manage_privacy_settings", "/calls/manage_privacy_settings"], authenticateUser, privacyController.updateSettings);

module.exports = router;
