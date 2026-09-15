const pool = require("../config/database");
const profileRepository = require("../repositories/profile.repository");
const interestRepository = require("../repositories/interest.repository");
const userRepository = require("../repositories/user.repository");

class ProfileService {
  async getProfileCompletion(userId) {
    let percentage = 0;
    const sections = {};

    const [userRows] = await pool.execute(
      "SELECT first_name, last_name, gender, dob, is_verified FROM users WHERE id = $1",
      [userId]
    );
    const row = userRows[0] || null;

    if (
      row &&
      row.is_verified &&
      row.first_name &&
      row.last_name &&
      row.gender &&
      row.dob
    ) {
      percentage += 20;
      sections.basic = true;
    } else {
      sections.basic = false;
    }

    sections.family = await profileRepository.rowExists("family_details", userId);
    if (sections.family) percentage += 20;

    sections.physical = await profileRepository.rowExists("physical_details", userId);
    if (sections.physical) percentage += 20;

    sections.address = await profileRepository.rowExists("user_addresses", userId);
    if (sections.address) percentage += 20;

    sections.marital_professional = await profileRepository.rowExists("marital_professional_details", userId);
    if (sections.marital_professional) percentage += 10;

    sections.partner_preferences = await profileRepository.rowExists("partner_preferences", userId);
    if (sections.partner_preferences) percentage += 10;

    sections.document = await profileRepository.rowExists("user_document", userId);

    const flowOrder = [
      "basic",
      "address",
      "family",
      "physical",
      "marital_professional",
      "partner_preferences",
      "document"
    ];

    let next_step = "completed";
    for (const step of flowOrder) {
      if (sections[step] === false) {
        next_step = step;
        break;
      }
    }

    return {
      percentage,
      next_step,
      is_completed: next_step === "completed"
    };
  }

  async updateBasicDetails(userId, data) {
    const { first_name, gender, dob, profile_for } = data;
    if (!first_name || !gender || !dob || !profile_for) {
      return { success: 0, message: "Required fields missing" };
    }

    await profileRepository.updateBasicDetails(userId, data);
    return { success: 1, message: "Basic details updated successfully" };
  }

  async addFamilyDetails(userId, data) {
    const { father_name, mother_name, siblings, father_occupations, family_type } = data;
    if (!father_name || !mother_name || siblings < 0 || !father_occupations || !family_type) {
      return { success: 0, message: "Required fields missing" };
    }

    await profileRepository.saveFamilyDetails(userId, data);
    return { success: 1, message: "Family details saved successfully" };
  }

  async addPhysicalDetails(userId, data) {
    const { height, weight } = data;
    if (!height || parseFloat(weight) <= 0) {
      return { success: 0, message: "Height & weight required" };
    }

    const allowedManglik = ["yes", "no", "dont_know"];
    data.manglik = allowedManglik.includes(data.manglik) ? data.manglik : "dont_know";

    const allowedThal = ["major", "minor", "dont_know"];
    data.thalassemia_status = allowedThal.includes(data.thalassemia_status) ? data.thalassemia_status : "dont_know";

    await profileRepository.savePhysicalDetails(userId, data);
    return { success: 1, message: "Physical details saved successfully" };
  }

  async addOrUpdateAddress(userId, data) {
    const { address_type, address_line, state_id, district_id, city_id } = data;

    if (!["current", "permanent"].includes(address_type)) {
      return { success: 0, message: "Invalid address type" };
    }

    if (!state_id || !district_id || !city_id || !address_line) {
      return { success: 0, message: "Invalid address data" };
    }

    const action = await profileRepository.saveAddress(userId, data);
    return { success: 1, action };
  }

  async addMaritalProfessionalDetails(userId, data) {
    const action = await profileRepository.saveMaritalProfessionalDetails(userId, data);
    return {
      success: 1,
      message: `Marital & professional details ${action} successfully`
    };
  }

  async savePartnerPreferences(userId, data) {
    const { age_min, age_max, height_min, height_max, weight_min, weight_max } = data;

    if (age_min !== null && age_max !== null && age_min > age_max) {
      return { success: 0, message: "age_min cannot be greater than age_max" };
    }
    if (height_min !== null && height_max !== null && height_min > height_max) {
      return { success: 0, message: "height_min cannot be greater than height_max" };
    }
    if (weight_min !== null && weight_max !== null && weight_min > weight_max) {
      return { success: 0, message: "weight_min cannot be greater than weight_max" };
    }

    const action = await profileRepository.savePartnerPreferences(userId, data);
    return {
      success: 1,
      message: `Partner preferences ${action} successfully`
    };
  }

  async getUserRow(userId, table) {
    const data = await profileRepository.getUserRow(userId, table);
    return { success: 1, data };
  }

  async getCompleteProfile(userId, fcmToken = null) {
    if (fcmToken) {
      await userRepository.updateFCMToken(userId, fcmToken);
    }
    const profileData = await profileRepository.getCompleteProfile(userId);
    if (!profileData) {
      return { success: 0, message: "User not found" };
    }
    return { success: 1, data: profileData };
  }

  async getPartnerProfile(userId, profileUserId) {
    const hasAccepted = await interestRepository.hasAcceptedInterest(userId, profileUserId);
    if (!hasAccepted) {
      return {
        success: 0,
        message: "Access denied. You have not accepted interest from this profile."
      };
    }

    const sub = await interestRepository.getActiveSubscription(userId);
    if (!sub) {
      return {
        success: 0,
        message: "Subscription expired. Please subscribe to view partner profiles."
      };
    }

    if (sub.remaining_interests <= 0) {
      return { success: 0, message: "Profile view limit exceeded" };
    }

    const [rows] = await pool.execute(
      `SELECT 
        u.id, u.first_name, u.last_name, u.sub_caste, u.email, u.gender, u.dob, u.phone, u.profile_for,
        EXTRACT(YEAR FROM age(CURRENT_DATE, u.dob)) AS age,
        pd.height, pd.weight, pd.smoking, pd.drinking, pd.diet, pd.is_disabled, pd.disability_details, pd.languages_known, pd.manglik, pd.marital_status, pd.thalassemia_status,
        fd.father_name, fd.mother_name, fd.maternal_surname, fd.siblings, fd.family_type, fd.father_occupations,
        mpd.highest_degree, mpd.university_name, mpd.degree, mpd.annual_income, mpd.occupation, mpd.work_city,
        pp.age_min, pp.age_max, pp.height_min, pp.height_max, pp.weight_min, pp.weight_max, pp.preferred_marital_status, pp.preferred_education, pp.preferred_occupation,
        ud.profile,
        u.is_active, u.created_at
      FROM users u
      LEFT JOIN physical_details pd ON pd.user_id = u.id
      LEFT JOIN family_details fd ON fd.user_id = u.id
      LEFT JOIN marital_professional_details mpd ON mpd.user_id = u.id
      LEFT JOIN partner_preferences pp ON pp.user_id = u.id
      LEFT JOIN user_document ud ON ud.user_id = u.id
      WHERE u.id = $1 AND u.is_verified = 1`,
      [profileUserId]
    );

    if (rows.length === 0) {
      return { success: 0, message: "User not found" };
    }

    const data = rows[0];
    const [photoRows] = await pool.execute(
      "SELECT image_url FROM user_photos WHERE user_id = $1 ORDER BY id ASC",
      [profileUserId]
    );
    data.images = photoRows.map((p) => p.image_url);

    return { success: 1, data };
  }

  async getImages(userId) {
    const [rows] = await pool.execute(
      "SELECT image_url FROM user_photos WHERE user_id = $1",
      [userId]
    );
    const images = rows.map((r) => r.image_url);
    return { success: 1, data: { profile: images } };
  }
}

module.exports = new ProfileService();
