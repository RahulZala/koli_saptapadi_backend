const express = require("express");
const router = express.Router();
const imageController = require("../controllers/image.controller");
const { authenticateUser } = require("../middleware/auth");

router.post(["/manage_image", "/calls/manage_image"], authenticateUser, imageController.manageImage);
router.post(["/get_image", "/calls/get_image"], authenticateUser, imageController.getImage);
router.post(["/get_photo_upload_url", "/calls/get_photo_upload_url"], authenticateUser, imageController.getPhotoUploadUrl);

module.exports = router;
