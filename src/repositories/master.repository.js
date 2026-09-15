const pool = require("../config/database");

class MasterRepository {
  async getStates() {
    const [rows] = await pool.execute(
      "SELECT id, name FROM states ORDER BY name ASC"
    );
    return rows;
  }

  async getDistricts(stateId) {
    const [rows] = await pool.execute(
      "SELECT id, name FROM districts WHERE state_id = $1 ORDER BY name ASC",
      [stateId]
    );
    return rows;
  }

  async getCities(districtId) {
    const [rows] = await pool.execute(
      "SELECT id, name FROM cities WHERE district_id = $1 ORDER BY name ASC",
      [districtId]
    );
    return rows;
  }

  async getSubCastes() {
    const [rows] = await pool.execute(
      "SELECT id, name FROM sub_castes WHERE is_active = 1"
    );
    return rows;
  }
}

module.exports = new MasterRepository();
