const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticateUser } = require("../middleware/auth");

// Public Auth Endpoints
router.post("/login", authController.login);
router.post("/send_otp", authController.sendOTP);
router.post("/verify_otp", authController.verifyOTP);

// Authenticated Auth Endpoints
router.post("/logout_user", authenticateUser, authController.logout);
router.post("/delete_user", authenticateUser, authController.deleteAccount);

module.exports = router;
