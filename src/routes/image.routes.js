const express = require("express");
const router = express.Router();
const imageController = require("../controllers/image.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/manage_image", authenticateUser, imageController.manageImage);
router.post("/get_image", authenticateUser, imageController.getImage);

module.exports = router;
