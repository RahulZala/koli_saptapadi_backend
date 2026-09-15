const masterRepository = require("../repositories/master.repository");

class LocationController {
  async getStates(req, res, next) {
    try {
      const states = await masterRepository.getStates();
      return res.status(200).json({ success: 1, data: states });
    } catch (err) {
      next(err);
    }
  }

  async getDistricts(req, res, next) {
    try {
      const state_id = req.body.state_id || req.query.state_id;
      if (!state_id) {
        return res.status(200).json({ success: 0, message: "No districts found" });
      }
      const districts = await masterRepository.getDistricts(state_id);
      return res.status(200).json({ success: 1, data: districts });
    } catch (err) {
      next(err);
    }
  }

  async getCities(req, res, next) {
    try {
      const district_id = req.body.district_id || req.query.district_id;
      if (!district_id) {
        return res.status(200).json({ success: 0, message: "No cities available" });
      }
      const cities = await masterRepository.getCities(district_id);
      return res.status(200).json({ success: 1, data: cities });
    } catch (err) {
      next(err);
    }
  }

  async getSubCastes(req, res, next) {
    try {
      const subCastes = await masterRepository.getSubCastes();
      return res.status(200).json({ success: 1, data: subCastes });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LocationController();
