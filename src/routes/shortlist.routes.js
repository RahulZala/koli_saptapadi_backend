const express = require("express");
const router = express.Router();
const shortlistController = require("../controllers/shortlist.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/shortlist", "/calls/shortlist", "/manage_shortlist"], authenticateUser, shortlistController.toggleShortlist);
router.post(["/shortlist_list", "/calls/shortlist_list", "/get_shortlists"], authenticateUser, shortlistController.getShortlists);

module.exports = router;
