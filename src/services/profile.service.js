const pool = require("../config/database");
const profileRepository = require("../repositories/profile.repository");
const interestRepository = require("../repositories/interest.repository");
const userRepository = require("../repositories/user.repository");
const privacyRepository = require("../repositories/privacy.repository");
const blockRepository = require("../repositories/block.repository");

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
    const { first_name, gender, dob, profile_for, referral_code } = data;
    if (!first_name || !gender || !dob || !profile_for) {
      return { success: 0, message: "Required fields missing" };
    }

    await profileRepository.updateBasicDetails(userId, data);

    // If referral_code was provided at register time:
    let referralResult = null;
    if (referral_code && String(referral_code).trim()) {
      const referralRepository = require("../repositories/referral.repository");
      referralResult = await referralRepository.applyReferralCode(userId, String(referral_code).trim());
    }

    return {
      success: 1,
      message: referralResult && referralResult.success === 1
        ? "Basic details saved & referral applied (+3 Send Interests added to both accounts!)"
        : "Basic details updated successfully",
      referral_applied: referralResult ? referralResult.success === 1 : false
    };
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
    const targetId = parseInt(profileUserId, 10);
    if (!targetId || targetId <= 0) {
      return { success: 0, message: "A valid profile ID is required" };
    }

    const isSelf = parseInt(userId, 10) === targetId;
    const blockStatus = isSelf
      ? { blockedByMe: false, blockingMe: false }
      : await blockRepository.getBlockStatus(userId, targetId);
    if (blockStatus.blockingMe) {
      return { success: 0, message: "This profile is unavailable" };
    }
    if (blockStatus.blockedByMe) {
      return {
        success: 1,
        data: {
          relationship_status: "blocked",
          blocked_by_me: true,
          can_send_request: false
        }
      };
    }
    const [pairRequests, privacy] = await Promise.all([
      isSelf ? [] : interestRepository.getPairRequests(userId, targetId),
      privacyRepository.getPrivacySettings(targetId)
    ]);
    const accepted = isSelf || pairRequests.some((request) => request.status === "accepted");
    const pendingRequest = pairRequests.find((request) => request.status === "pending");
    const rejectedRequest = pairRequests.find((request) => request.status === "rejected");

    if (!isSelf && privacy.profile_status !== "active") {
      return { success: 0, message: "This profile is not currently available" };
    }

    const relationshipStatus = isSelf
      ? "self"
      : accepted
        ? "accepted"
        : pendingRequest
          ? "pending"
          : rejectedRequest
            ? "rejected"
            : "none";
    const requestDirection = pendingRequest
      ? (parseInt(pendingRequest.from_user, 10) === parseInt(userId, 10) ? "outgoing" : "incoming")
      : null;
    const canSendRequest = !isSelf &&
      !accepted &&
      !pendingRequest &&
      !pairRequests.some((request) =>
        request.status === "rejected" && parseInt(request.from_user, 10) === parseInt(userId, 10)
      );
    const canViewPhone = isSelf ||
      privacy.phone_visibility === "public" ||
      (accepted && ["on_accept", "request_only"].includes(privacy.phone_visibility));
    const canViewEmail = isSelf || accepted;
    const canViewPhotos = isSelf || accepted || privacy.photo_privacy === "public";
    const contactColumns = [
      canViewPhone ? "u.phone" : null,
      canViewEmail ? "u.email" : null
    ].filter(Boolean).join(", ");
    const photoColumn = canViewPhotos ? "ud.profile" : "NULL AS profile";

    const publicColumns = `
      u.id, u.first_name, u.last_name, u.sub_caste, u.gender,
      EXTRACT(YEAR FROM age(CURRENT_DATE, u.dob)) AS age,
      pd.height, pd.marital_status,
      mpd.highest_degree, mpd.degree, mpd.occupation, mpd.work_city,
      ${photoColumn}, u.is_active, u.is_verified, u.created_at
      ${contactColumns ? `, ${contactColumns}` : ""}
    `;
    const connectedColumns = `
      u.id, u.first_name, u.last_name, u.sub_caste, u.gender, u.dob, u.profile_for,
      EXTRACT(YEAR FROM age(CURRENT_DATE, u.dob)) AS age,
      pd.height, pd.weight, pd.smoking, pd.drinking, pd.diet, pd.is_disabled,
      pd.disability_details, pd.languages_known, pd.manglik, pd.marital_status,
      pd.thalassemia_status,
      fd.father_name, fd.mother_name, fd.maternal_surname, fd.siblings,
      fd.family_type, fd.father_occupations,
      mpd.highest_degree, mpd.university_name, mpd.degree, mpd.annual_income,
      mpd.occupation, mpd.work_city,
      pp.age_min, pp.age_max, pp.height_min, pp.height_max, pp.weight_min,
      pp.weight_max, pp.preferred_marital_status, pp.preferred_education,
      pp.preferred_occupation,
      ${photoColumn}, u.is_active, u.is_verified, u.created_at
      ${contactColumns ? `, ${contactColumns}` : ""}
    `;
    const profileColumns = accepted ? connectedColumns : publicColumns;
    const joins = accepted
      ? `LEFT JOIN physical_details pd ON pd.user_id = u.id
         LEFT JOIN family_details fd ON fd.user_id = u.id
         LEFT JOIN marital_professional_details mpd ON mpd.user_id = u.id
         LEFT JOIN partner_preferences pp ON pp.user_id = u.id`
      : `LEFT JOIN physical_details pd ON pd.user_id = u.id
         LEFT JOIN marital_professional_details mpd ON mpd.user_id = u.id`;
    const [rows] = await pool.execute(
      `SELECT ${profileColumns}
       FROM users u
       ${joins}
       LEFT JOIN user_document ud ON ud.user_id = u.id
       WHERE u.id = $1`,
      [targetId]
    );

    if (rows.length === 0) {
      return { success: 0, message: "User not found" };
    }

    const data = rows[0];
    data.height = data.height === null || data.height === undefined ? "" : String(data.height);
    data.marital_status = data.marital_status || "";
    data.degree = data.degree || "";
    data.highest_degree = data.highest_degree || "";
    data.occupation = data.occupation || "";
    data.work_city = data.work_city || "";
    if (!accepted) {
      Object.assign(data, {
        dob: "",
        profile_for: "",
        weight: 0,
        smoking: "",
        drinking: "",
        diet: "",
        is_disabled: "",
        disability_details: "",
        languages_known: "",
        manglik: "",
        thalassemia_status: "",
        father_name: "",
        mother_name: "",
        maternal_surname: "",
        siblings: 0,
        family_type: "",
        father_occupations: "",
        university_name: "",
        annual_income: "",
        age_min: 0,
        age_max: 0,
        height_min: "",
        height_max: "",
        weight_min: 0,
        weight_max: 0,
        preferred_marital_status: "",
        preferred_education: "",
        preferred_occupation: ""
      });
    }
    if (canViewPhotos) {
      const [photoRows] = await pool.execute(
        "SELECT image_url FROM user_photos WHERE user_id = $1 ORDER BY id ASC",
        [targetId]
      );
      data.images = photoRows.map((photo) => photo.image_url);
    } else {
      data.images = [];
    }
    data.relationship_status = relationshipStatus;
    data.request_direction = requestDirection;
    data.request_id = pendingRequest ? pendingRequest.id : null;
    data.can_send_request = canSendRequest;
    data.blocked_by_me = false;

    return { success: 1, data };
  }

  async manageProfileBlock(userId, profileUserId, action) {
    const targetId = parseInt(profileUserId, 10);
    if (!targetId || targetId <= 0 || targetId === parseInt(userId, 10)) {
      return { success: 0, message: "A valid different profile is required" };
    }
    if (action !== "block" && action !== "unblock") {
      return { success: 0, message: "Invalid block action" };
    }
    if (action === "block") {
      const [users] = await pool.execute("SELECT id FROM users WHERE id = $1 AND is_active = true", [targetId]);
      if (!users.length) {
        return { success: 0, message: "This profile is unavailable" };
      }
    }
    await blockRepository.setBlock(userId, targetId, action === "block");
    return {
      success: 1,
      message: action === "block" ? "Profile blocked" : "Profile unblocked",
      data: { blocked_by_me: action === "block" }
    };
  }

  async getImages(viewerId, profileUserId = viewerId) {
    const targetId = parseInt(profileUserId, 10);
    if (!targetId || targetId <= 0) {
      return { success: 0, message: "A valid profile ID is required" };
    }
    const isSelf = parseInt(viewerId, 10) === targetId;
    if (!isSelf && await blockRepository.isBlockedBetween(viewerId, targetId)) {
      return { success: 0, message: "This profile is unavailable" };
    }
    const privacy = await privacyRepository.getPrivacySettings(targetId);
    const accepted = isSelf || await interestRepository.hasAcceptedInterest(viewerId, targetId);
    if (!isSelf && privacy.profile_status !== "active") {
      return { success: 0, message: "This profile is not currently available" };
    }
    if (!isSelf && !accepted && privacy.photo_privacy !== "public") {
      return { success: 1, data: { profile: [] } };
    }

    const [rows] = await pool.execute(
      "SELECT image_url FROM user_photos WHERE user_id = $1 ORDER BY id ASC",
      [targetId]
    );
    const images = rows.map((r) => r.image_url);
    return { success: 1, data: { profile: images } };
  }
}

module.exports = new ProfileService();
