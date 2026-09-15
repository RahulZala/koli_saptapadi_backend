const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profile.controller");
const { authenticateUser } = require("../middleware/auth");

router.post("/get_profile_data", authenticateUser, profileController.getProfileData);
router.post("/my_profile", authenticateUser, profileController.getMyProfile);
router.post("/manage_basic_details", authenticateUser, profileController.updateBasicDetails);
router.post("/manage_family_details", authenticateUser, profileController.addFamilyDetails);
router.post("/manage_physical_details", authenticateUser, profileController.addPhysicalDetails);
router.post("/manage_address", authenticateUser, profileController.manageAddress);
router.post("/manage_marital_professional_details", authenticateUser, profileController.addMaritalDetails);
router.post("/manage_partner_preference", authenticateUser, profileController.savePartnerPreferences);
router.post("/view_profile", authenticateUser, profileController.viewProfile);

module.exports = router;
