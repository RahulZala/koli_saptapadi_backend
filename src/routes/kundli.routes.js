const express = require("express");
const router = express.Router();
const kundliController = require("../controllers/kundli.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/get_kundli_details", "/calls/get_kundli_details"], authenticateUser, kundliController.getKundli);
router.post(["/manage_kundli_details", "/calls/manage_kundli_details"], authenticateUser, kundliController.saveKundli);

module.exports = router;
