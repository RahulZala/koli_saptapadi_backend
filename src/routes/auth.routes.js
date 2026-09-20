const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticateUser } = require("../middleware/auth");

// Public Auth Endpoints
router.post("/login", authController.login);
router.post(["/send_otp", "/calls/send_otp", "/otp/send", "/v1/otp/send"], authController.sendOTP);
router.post(["/verify_otp", "/calls/verify_otp", "/otp/verify", "/v1/otp/verify"], authController.verifyOTP);

// Authenticated Auth Endpoints
router.post(["/logout_user", "/calls/logout_user", "/logout"], authenticateUser, authController.logout);
router.post(["/delete_user", "/calls/delete_user", "/delete_account"], authenticateUser, authController.deleteAccount);

module.exports = router;
