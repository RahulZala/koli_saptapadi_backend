const express = require("express");
const router = express.Router();
const biodataController = require("../controllers/biodata.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/generate_biodata", "/calls/generate_biodata"], authenticateUser, biodataController.generateBiodata);

module.exports = router;
