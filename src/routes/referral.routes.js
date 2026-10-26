const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referral.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/get_referral_info", "/calls/get_referral_info"], authenticateUser, referralController.getInfo);
router.post(["/apply_referral", "/calls/apply_referral"], authenticateUser, referralController.apply);
router.all(["/get_addon_plans", "/calls/get_addon_plans"], authenticateUser, referralController.getAddons);

module.exports = router;
