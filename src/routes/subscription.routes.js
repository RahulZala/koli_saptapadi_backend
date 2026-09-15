const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscription.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/get_plan", authenticateUser, subscriptionController.getPlans);
router.post("/create_order", authenticateUser, subscriptionController.createOrder);
router.post("/subscribe_plan", authenticateUser, subscriptionController.subscribePlan);
router.post("/subscribe_history", authenticateUser, subscriptionController.getPaymentHistory);
router.post("/cancel_order", authenticateUser, subscriptionController.cancelOrder);

module.exports = router;
