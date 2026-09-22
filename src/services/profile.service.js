const pool = require("../config/database");
const profileRepository = require("../repositories/profile.repository");
const interestRepository = require("../repositories/interest.repository");
const userRepository = require("../repositories/user.repository");

class ProfileService {
  async getProfileCompletion(userId) {
    let percentage = 0;
    const sections = {};

    const [userRows] = await pool.execute(
      `SELECT 
        first_name, last_name, gender, dob, is_verified,
        family_completed, physical_completed, address_completed,
        marital_professional_completed, partner_preferences_completed, document
      FROM users WHERE id = $1`,
      [userId]
    );
    const row = userRows[0] || null;

    const isNonEmpty = (val) => {
      if (!val) return false;
      const str = String(val).trim().replace(/^"|"$/g, "");
      return str.length > 0;
    };

    const isFlagTrue = (val) => val === true || val === 1 || val === "1" || val === "true";

    // 1. Basic Details
    if (
      row &&
      isFlagTrue(row.is_verified) &&
      isNonEmpty(row.first_name) &&
      isNonEmpty(row.last_name) &&
      isNonEmpty(row.gender) &&
      Boolean(row.dob)
    ) {
      percentage += 20;
      sections.basic = true;
    } else {
      sections.basic = false;
    }

    // 2. Family Details (Requires both users.family_completed = true AND record in family_details)
    const familyRowExists = await profileRepository.rowExists("family_details", userId);
    sections.family = Boolean(isFlagTrue(row?.family_completed) && familyRowExists);
    if (sections.family) percentage += 20;

    // 3. Physical Details (Requires both users.physical_completed = true AND record in physical_details)
    const physicalRowExists = await profileRepository.rowExists("physical_details", userId);
    sections.physical = Boolean(isFlagTrue(row?.physical_completed) && physicalRowExists);
    if (sections.physical) percentage += 20;

    // 4. Address Details (Requires both users.address_completed = true AND record in user_addresses)
    const addressRowExists = await profileRepository.rowExists("user_addresses", userId);
    sections.address = Boolean(isFlagTrue(row?.address_completed) && addressRowExists);
    if (sections.address) percentage += 20;

    // 5. Marital & Professional Details
    const mpRowExists = await profileRepository.rowExists("marital_professional_details", userId);
    sections.marital_professional = Boolean(isFlagTrue(row?.marital_professional_completed) && mpRowExists);
    if (sections.marital_professional) percentage += 10;

    // 6. Partner Preferences
    const ppRowExists = await profileRepository.rowExists("partner_preferences", userId);
    sections.partner_preferences = Boolean(isFlagTrue(row?.partner_preferences_completed) && ppRowExists);
    if (sections.partner_preferences) percentage += 10;

    // 7. Documents
    const docRowExists = await profileRepository.rowExists("user_document", userId);
    sections.document = Boolean(isFlagTrue(row?.document) && docRowExists);

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
    const father_name = String(data.father_name || "").trim();
    const mother_name = String(data.mother_name || "").trim();
    const siblings = data.siblings !== undefined && data.siblings !== null && data.siblings !== ""
      ? parseInt(data.siblings, 10)
      : -1;
    const father_occupations = String(data.father_occupations || data.father_occupation || "").trim();
    const family_type = String(data.family_type || "").trim();
    const maternal_surname = String(data.maternal_surname || "").trim();

    if (!father_name || !mother_name || isNaN(siblings) || siblings < 0 || !father_occupations || !family_type) {
      return { success: 0, message: "Required fields missing" };
    }

    await profileRepository.saveFamilyDetails(userId, {
      father_name,
      mother_name,
      siblings,
      father_occupations,
      family_type,
      maternal_surname
    });
    return { success: 1, message: "Family details saved successfully" };
  }

  async addPhysicalDetails(userId, data) {
    let height = data.height;
    if (typeof height === "string" && (height.includes("'") || height.includes("’") || height.includes("ft"))) {
      const match = height.match(/^(\d+)\s*['’]\s*(\d+)?/);
      if (match) {
        const ft = parseInt(match[1], 10);
        const inch = parseInt(match[2] || "0", 10);
        height = Math.round((ft * 30.48) + (inch * 2.54));
      }
    }
    const weight = parseFloat(data.weight || 0);

    if (!height || weight <= 0) {
      return { success: 0, message: "Height & weight required" };
    }

    const manglikRaw = (data.manglik || data.manglic || "").toString().toLowerCase().trim();
    const allowedManglik = ["yes", "no", "dont_know"];
    const manglik = allowedManglik.includes(manglikRaw) ? manglikRaw : "dont_know";

    const thalRaw = (data.thalassemia_status || data.thalassemia || "").toString().toLowerCase().trim();
    const allowedThal = ["major", "minor", "dont_know"];
    const thalassemia_status = allowedThal.includes(thalRaw) ? thalRaw : "dont_know";

    // Safely parse child_count for PostgreSQL INT column (empty string becomes 0)
    const rawChildCount = data.child_count !== undefined ? data.child_count : data.children_count;
    let child_count = 0;
    if (rawChildCount !== undefined && rawChildCount !== null && rawChildCount !== "") {
      const parsed = parseInt(rawChildCount, 10);
      child_count = isNaN(parsed) ? 0 : parsed;
    }

    await profileRepository.savePhysicalDetails(userId, {
      ...data,
      height: String(height),
      weight,
      manglik,
      thalassemia_status,
      child_count
    });
    return { success: 1, message: "Physical details saved successfully" };
  }

  async addOrUpdateAddress(userId, data) {
    if (!data) {
      return { success: 0, message: "Invalid JSON" };
    }

    // Format 1: Android App format with permanent_address (required) and current_address (optional)
    if (data.permanent_address || data.current_address) {
      const permanent = data.permanent_address;
      if (!permanent) {
        return { success: 0, message: "Permanent address required" };
      }

      const pa_address = String(permanent.address_line || "").trim();
      const pa_district = parseInt(permanent.district_id || 0, 10);
      const pa_city = parseInt(permanent.city_id || 0, 10);

      if (!pa_address || pa_district <= 0 || pa_city <= 0) {
        return { success: 0, message: "Permanent address, district & city required" };
      }

      await profileRepository.saveAddress(userId, {
        address_type: "permanent",
        address_line: pa_address,
        landmark: String(permanent.landmark || "").trim(),
        state_id: parseInt(permanent.state_id || 0, 10),
        district_id: pa_district,
        city_id: pa_city,
        pincode: String(permanent.pincode || "").trim()
      });

      const current = data.current_address;
      if (current && (current.address_line || current.district_id || current.city_id)) {
        const ca_address = String(current.address_line || "").trim();
        const ca_district = parseInt(current.district_id || 0, 10);
        const ca_city = parseInt(current.city_id || 0, 10);

        if (!ca_address || ca_district <= 0 || ca_city <= 0) {
          return { success: 0, message: "Current address, district & city required" };
        }

        await profileRepository.saveAddress(userId, {
          address_type: "current",
          address_line: ca_address,
          landmark: String(current.landmark || "").trim(),
          state_id: parseInt(current.state_id || 0, 10),
          district_id: ca_district,
          city_id: ca_city,
          pincode: String(current.pincode || "").trim()
        });
      }

      return { success: 1, message: "Address saved successfully" };
    }

    // Format 2: Flat payload with address_type
    const { address_type, address_line, state_id, district_id, city_id, landmark, pincode } = data;

    if (!["current", "permanent"].includes(address_type)) {
      return { success: 0, message: "Invalid address type" };
    }

    if (!state_id || !district_id || !city_id || !address_line) {
      return { success: 0, message: "Invalid address data" };
    }

    const action = await profileRepository.saveAddress(userId, {
      address_type,
      address_line: String(address_line).trim(),
      landmark: String(landmark || "").trim(),
      state_id: parseInt(state_id, 10),
      district_id: parseInt(district_id, 10),
      city_id: parseInt(city_id, 10),
      pincode: String(pincode || "").trim()
    });
    return { success: 1, message: "Address saved successfully", action };
  }

  async addMaritalProfessionalDetails(userId, data) {
    const highest_degree = data.highest_education || data.highest_degree || "";
    const university = data.university || data.university_name || "";
    const payload = {
      ...data,
      highest_degree,
      university
    };
    const action = await profileRepository.saveMaritalProfessionalDetails(userId, payload);
    return {
      success: 1,
      message: `Marital & professional details ${action} successfully`
    };
  }

  async savePartnerPreferences(userId, data) {
    const convertHeightToCm = (val) => {
      if (val === null || val === undefined || val === "") return null;
      if (typeof val === "number") return val > 0 ? Math.round(val) : null;
      const str = String(val).trim();
      if (!str) return null;

      const ftInMatch = str.match(/^(\d+)\s*(?:'|’|ft|feet|\s)\s*(\d+)?/i);
      if (ftInMatch) {
        const ft = parseInt(ftInMatch[1], 10);
        const inch = parseInt(ftInMatch[2] || "0", 10);
        return Math.round((ft * 30.48) + (inch * 2.54));
      }

      const num = parseFloat(str);
      return !isNaN(num) && num > 0 ? Math.round(num) : null;
    };

    const height_min = convertHeightToCm(data.height_min_ft ?? data.height_min);
    const height_max = convertHeightToCm(data.height_max_ft ?? data.height_max);

    const age_min = data.age_min !== undefined && data.age_min !== null && data.age_min !== "" ? parseInt(data.age_min, 10) : null;
    const age_max = data.age_max !== undefined && data.age_max !== null && data.age_max !== "" ? parseInt(data.age_max, 10) : null;
    const weight_min = data.weight_min !== undefined && data.weight_min !== null && data.weight_min !== "" ? parseInt(data.weight_min, 10) : null;
    const weight_max = data.weight_max !== undefined && data.weight_max !== null && data.weight_max !== "" ? parseInt(data.weight_max, 10) : null;

    if (age_min !== null && age_max !== null && age_min > age_max) {
      return { success: 0, message: "age_min cannot be greater than age_max" };
    }
    if (height_min !== null && height_max !== null && height_min > height_max) {
      return { success: 0, message: "height_min cannot be greater than height_max" };
    }
    if (weight_min !== null && weight_max !== null && weight_min > weight_max) {
      return { success: 0, message: "weight_min cannot be greater than weight_max" };
    }

    const payload = {
      ...data,
      age_min,
      age_max,
      height_min,
      height_max,
      weight_min,
      weight_max,
      preferred_marital_status: String(data.preferred_marital_status || "").trim(),
      preferred_education: String(data.preferred_education || "").trim(),
      preferred_occupation: String(data.preferred_occupation || "").trim()
    };

    const action = await profileRepository.savePartnerPreferences(userId, payload);
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
      WHERE u.id = $1 AND u.is_verified = true`,
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
