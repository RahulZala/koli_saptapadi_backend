const express = require("express");
const router = express.Router();
const profileViewsController = require("../controllers/profile-views.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/profile_views_list", "/calls/profile_views_list", "/who_viewed_me"], authenticateUser, profileViewsController.getViewers);

module.exports = router;
