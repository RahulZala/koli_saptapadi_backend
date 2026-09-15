const express = require("express");
const router = express.Router();
const locationController = require("../controllers/location.controller");

// Master data location endpoints (public or authenticated)
router.all("/get_states", locationController.getStates);
router.all("/get_districts", locationController.getDistricts);
router.all("/get_cities", locationController.getCities);
router.all("/get_sub_castes", locationController.getSubCastes);

module.exports = router;
