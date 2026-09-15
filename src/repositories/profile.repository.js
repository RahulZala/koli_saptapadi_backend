const pool = require("../config/database");

class ProfileRepository {
  async rowExists(table, userId) {
    const allowedTables = [
      "family_details",
      "physical_details",
      "user_addresses",
      "marital_professional_details",
      "partner_preferences",
      "user_document"
    ];
    if (!allowedTables.includes(table)) return false;

    const [rows] = await pool.execute(
      `SELECT id FROM ${table} WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  }

  async updateBasicDetails(userId, data) {
    const { first_name, last_name, gender, dob, profile_for, email, sub_caste } = data;
    await pool.execute(
      `UPDATE users SET
        first_name = $1,
        last_name = $2,
        gender = $3,
        dob = $4,
        profile_for = $5,
        email = $6,
        sub_caste = $7
      WHERE id = $8`,
      [first_name, last_name, gender, dob, profile_for, email, sub_caste, userId]
    );
  }

  async saveFamilyDetails(userId, data) {
    const { father_name, mother_name, siblings, father_occupations, family_type, maternal_surname } = data;
    const exists = await this.rowExists("family_details", userId);

    if (exists) {
      await pool.execute(
        `UPDATE family_details SET
          father_name = $1, mother_name = $2, siblings = $3, father_occupations = $4, family_type = $5, maternal_surname = $6
        WHERE user_id = $7`,
        [father_name, mother_name, siblings, father_occupations, family_type, maternal_surname, userId]
      );
    } else {
      await pool.execute(
        `INSERT INTO family_details (user_id, father_name, mother_name, siblings, father_occupations, family_type, maternal_surname)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, father_name, mother_name, siblings, father_occupations, family_type, maternal_surname]
      );
    }

    await pool.execute("UPDATE users SET family_completed = 1 WHERE id = $1", [userId]);
  }

  async savePhysicalDetails(userId, data) {
    const { height, weight, smoking, drinking, diet, is_disabled, disability_details, languages_known, manglik, marital_status, child_count, thalassemia_status } = data;
    const exists = await this.rowExists("physical_details", userId);

    if (exists) {
      await pool.execute(
        `UPDATE physical_details SET
          height = $1, weight = $2, smoking = $3, drinking = $4, diet = $5, is_disabled = $6, disability_details = $7, languages_known = $8, manglik = $9, marital_status = $10, child_count = $11, thalassemia_status = $12
        WHERE user_id = $13`,
        [height, weight, smoking, drinking, diet, is_disabled, disability_details, languages_known, manglik, marital_status, child_count, thalassemia_status, userId]
      );
    } else {
      await pool.execute(
        `INSERT INTO physical_details (user_id, height, weight, smoking, drinking, diet, is_disabled, disability_details, languages_known, manglik, marital_status, child_count, thalassemia_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [userId, height, weight, smoking, drinking, diet, is_disabled, disability_details, languages_known, manglik, marital_status, child_count, thalassemia_status]
      );
    }

    await pool.execute("UPDATE users SET physical_completed = 1 WHERE id = $1", [userId]);
  }

  async saveAddress(userId, data) {
    const { address_type, address_line, landmark, state_id, district_id, city_id, pincode } = data;

    const [rows] = await pool.execute(
      "SELECT id FROM user_addresses WHERE user_id = $1 AND address_type = $2",
      [userId, address_type]
    );

    if (rows.length > 0) {
      await pool.execute(
        `UPDATE user_addresses SET
          address_line = $1, landmark = $2, state_id = $3, district_id = $4, city_id = $5, pincode = $6
        WHERE user_id = $7 AND address_type = $8`,
        [address_line, landmark, state_id, district_id, city_id, pincode, userId, address_type]
      );
      return "updated";
    } else {
      await pool.execute(
        `INSERT INTO user_addresses (user_id, address_type, address_line, landmark, state_id, district_id, city_id, pincode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, address_type, address_line, landmark, state_id, district_id, city_id, pincode]
      );
      await pool.execute("UPDATE users SET address_completed = 1 WHERE id = $1", [userId]);
      return "inserted";
    }
  }

  async saveMaritalProfessionalDetails(userId, data) {
    const { highest_degree, university, degree, occupation, annual_income, work_city } = data;
    const exists = await this.rowExists("marital_professional_details", userId);

    if (exists) {
      await pool.execute(
        `UPDATE marital_professional_details SET
          highest_degree = $1, occupation = $2, annual_income = $3, university_name = $4, degree = $5, work_city = $6
        WHERE user_id = $7`,
        [highest_degree, occupation, annual_income, university, degree, work_city, userId]
      );
      return "updated";
    } else {
      await pool.execute(
        `INSERT INTO marital_professional_details (user_id, highest_degree, occupation, annual_income, university_name, work_city, degree)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, highest_degree, occupation, annual_income, university, work_city, degree]
      );
      await pool.execute("UPDATE users SET marital_professional_completed = 1 WHERE id = $1", [userId]);
      return "added";
    }
  }

  async savePartnerPreferences(userId, data) {
    const { age_min, age_max, height_min, height_max, weight_min, weight_max, preferred_marital_status, preferred_education, preferred_occupation } = data;
    const exists = await this.rowExists("partner_preferences", userId);

    if (exists) {
      await pool.execute(
        `UPDATE partner_preferences SET
          age_min = $1, age_max = $2, height_min = $3, height_max = $4, weight_min = $5, weight_max = $6, preferred_marital_status = $7, preferred_education = $8, preferred_occupation = $9
        WHERE user_id = $10`,
        [age_min, age_max, height_min, height_max, weight_min, weight_max, preferred_marital_status, preferred_education, preferred_occupation, userId]
      );
      return "updated";
    } else {
      await pool.execute(
        `INSERT INTO partner_preferences (user_id, age_min, age_max, height_min, height_max, weight_min, weight_max, preferred_marital_status, preferred_education, preferred_occupation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, age_min, age_max, height_min, height_max, weight_min, weight_max, preferred_marital_status, preferred_education, preferred_occupation]
      );
      await pool.execute("UPDATE users SET partner_preferences_completed = 1 WHERE id = $1", [userId]);
      return "saved";
    }
  }

  async getUserRow(userId, table) {
    if (table === "users") {
      const [rows] = await pool.execute(
        "SELECT first_name, last_name, gender, email, dob, profile_for, phone, sub_caste FROM users WHERE id = $1",
        [userId]
      );
      return rows[0] || null;
    } else if (table === "physical_details") {
      const [rows] = await pool.execute(
        "SELECT height, weight, smoking, drinking, diet, is_disabled, disability_details, languages_known, manglik, marital_status, child_count, thalassemia_status FROM physical_details WHERE user_id = $1",
        [userId]
      );
      return rows[0] || null;
    } else if (table === "family_details") {
      const [rows] = await pool.execute(
        "SELECT father_name, mother_name, siblings, father_occupations, family_type, maternal_surname FROM family_details WHERE user_id = $1",
        [userId]
      );
      return rows[0] || null;
    } else if (table === "user_addresses") {
      const [rows] = await pool.execute(
        `SELECT a.address_type, a.address_line, a.landmark, a.state_id, s.name AS state_name, a.district_id, d.name AS district_name, a.city_id, c.name AS city_name, a.pincode
        FROM user_addresses a
        LEFT JOIN states s ON a.state_id = s.id
        LEFT JOIN districts d ON a.district_id = d.id
        LEFT JOIN cities c ON a.city_id = c.id
        WHERE a.user_id = $1`,
        [userId]
      );
      return rows;
    } else if (table === "marital_professional_details") {
      const [rows] = await pool.execute(
        "SELECT highest_degree, occupation, annual_income, university_name, work_city, degree FROM marital_professional_details WHERE user_id = $1",
        [userId]
      );
      return rows[0] || null;
    } else if (table === "partner_preferences") {
      const [rows] = await pool.execute(
        "SELECT age_min, age_max, height_min, height_max, weight_min, weight_max, preferred_occupation, preferred_marital_status, preferred_education FROM partner_preferences WHERE user_id = $1",
        [userId]
      );
      return rows[0] || null;
    }

    const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE user_id = $1`, [userId]);
    return rows[0] || null;
  }

  async getCompleteProfile(userId) {
    const [userRows] = await pool.execute(
      "SELECT id, first_name, last_name, phone, is_verified FROM users WHERE id = $1",
      [userId]
    );

    if (userRows.length === 0) return null;
    const user = userRows[0];

    const [docRows] = await pool.execute(
      "SELECT profile FROM user_document WHERE user_id = $1",
      [userId]
    );
    const userDoc = docRows[0] || null;

    const [subRows] = await pool.execute(
      "SELECT * FROM user_subscriptions WHERE user_id = $1 AND is_active = 1 ORDER BY id DESC LIMIT 1",
      [userId]
    );
    const planRow = subRows[0] || null;

    let plan = null;
    let isExpired = true;
    let canView = false;
    let needsUpgrade = true;

    if (planRow) {
      const today = new Date().toISOString().split("T")[0];
      const [planNameRows] = await pool.execute(
        "SELECT name FROM subscription_plans WHERE id = $1",
        [planRow.plan_id]
      );
      const planName = planNameRows[0] ? planNameRows[0].name : "Free Plan";

      plan = {
        plan_id: planRow.plan_id,
        plan_name: planName,
        start_date: planRow.start_date,
        end_date: planRow.end_date,
        is_active: Boolean(planRow.is_active),
        remaining_interests: planRow.remaining_interests
      };

      isExpired = !(today >= planRow.start_date && today <= planRow.end_date);
      if (!isExpired && planRow.remaining_interests > 0) {
        canView = true;
        needsUpgrade = false;
      }
    }

    return {
      user: {
        id: user.id,
        first_name: (user.first_name || "").trim(),
        last_name: (user.last_name || "").trim(),
        phone: user.phone,
        profile: userDoc ? userDoc.profile : null,
        is_verified: Boolean(user.is_verified)
      },
      plan,
      permissions: {
        can_view_profiles: canView,
        needs_upgrade: needsUpgrade
      }
    };
  }
}

module.exports = new ProfileRepository();
