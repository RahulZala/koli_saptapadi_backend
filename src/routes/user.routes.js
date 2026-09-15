const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/dashboard", authenticateUser, userController.getDashboard);
router.post("/report_user", authenticateUser, userController.reportUser);

module.exports = router;
