const express = require("express");
const router = express.Router();
const interestController = require("../controllers/interest.controller");
const notificationController = require("../controllers/notification.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/send_intrest", authenticateUser, interestController.sendInterest);
router.post("/manage_interest", authenticateUser, interestController.manageInterest);
router.post("/reject_intrest", authenticateUser, interestController.rejectInterest);
router.post("/interest_profile", authenticateUser, interestController.getInterests);

module.exports = router;
