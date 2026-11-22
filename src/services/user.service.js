const pool = require("../config/database");
const userRepository = require("../repositories/user.repository");
const shortlistRepository = require("../repositories/shortlist.repository");
const blockRepository = require("../repositories/block.repository");
const privacyRepository = require("../repositories/privacy.repository");
const interestRepository = require("../repositories/interest.repository");

class UserService {
  async getDashboardProfiles(userId, filters = {}, page = 1, limit = 20) {
    await blockRepository.ensureTable();
    await privacyRepository.ensureColumns();
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [userRows] = await pool.execute(
      "SELECT gender FROM users WHERE id = $1",
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return { success: 0, message: "User not found" };
    }

    const gender = userRows[0].gender;
    const oppositeGender = gender === "Male" ? "Female" : "Male";

    // 1. Fetch user partner preferences for compatibility matching
    const [prefRows] = await pool.execute(
      `SELECT age_min, age_max, height_min, height_max, weight_min, weight_max, 
              preferred_marital_status, preferred_education, preferred_occupation 
       FROM partner_preferences WHERE user_id = $1`,
      [userId]
    );
    const preferences = prefRows && prefRows[0] ? prefRows[0] : null;

    // 2. Fetch user's shortlisted profile IDs
    const shortlistedIds = new Set(await shortlistRepository.getShortlistedIds(userId));

    let sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.sub_caste, u.dob,
        pd.height, pd.weight, pd.marital_status, pd.diet, pd.manglik,
        mp.occupation, mp.work_city, mp.highest_degree, mp.degree,
        ua.city_id, ua.district_id, ua.state_id, c.name AS city,
        COALESCE(u.photo_privacy, 'public') AS photo_privacy,
        COALESCE(u.phone_visibility, 'on_accept') AS phone_visibility,
        CASE WHEN COALESCE(u.photo_privacy, 'public') = 'public' THEN up.profile ELSE NULL END AS profile,
        u.is_verified
      FROM users u
      LEFT JOIN physical_details pd ON pd.user_id = u.id
      LEFT JOIN marital_professional_details mp ON mp.user_id = u.id
      LEFT JOIN user_addresses ua ON ua.user_id = u.id AND ua.address_type = 'current'
      LEFT JOIN cities c ON ua.city_id = c.id
      LEFT JOIN user_document up ON up.user_id = u.id 
      WHERE u.gender = $1
        AND u.document = true
        AND COALESCE(u.profile_status, 'active') = 'active'
        AND u.id != $2
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = $2 AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = $2)
        )
        AND NOT EXISTS (
          SELECT 1 FROM interests i
          WHERE i.from_user = $3 AND i.to_user = u.id
          AND (
            i.status != 'rejected'
            OR (i.status = 'rejected' AND i.created_at >= NOW() - INTERVAL '7 days')
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM profile_views pv
          WHERE pv.user_id = $4 AND pv.viewed_user_id = u.id
          AND pv.created_at >= NOW() - INTERVAL '7 days'
        )
    `;

    const params = [oppositeGender, userId, userId, userId];
    let paramIndex = 5;

    // Multi-attribute filter handlers
    if (filters.age_min) {
      sql += ` AND u.dob <= CURRENT_DATE - ($${paramIndex} || ' years')::interval`;
      params.push(filters.age_min);
      paramIndex++;
    }
    if (filters.age_max) {
      sql += ` AND u.dob >= CURRENT_DATE - ($${paramIndex} || ' years')::interval`;
      params.push(filters.age_max);
      paramIndex++;
    }
    if (filters.city) {
      sql += ` AND (c.name ILIKE $${paramIndex} OR mp.work_city ILIKE $${paramIndex})`;
      params.push(`%${filters.city}%`);
      paramIndex++;
    }
    if (filters.city_id) {
      sql += ` AND ua.city_id = $${paramIndex}`;
      params.push(parseInt(filters.city_id, 10));
      paramIndex++;
    }
    if (filters.district_id) {
      sql += ` AND ua.district_id = $${paramIndex}`;
      params.push(parseInt(filters.district_id, 10));
      paramIndex++;
    }
    if (filters.state_id) {
      sql += ` AND ua.state_id = $${paramIndex}`;
      params.push(parseInt(filters.state_id, 10));
      paramIndex++;
    }
    if (filters.height_min) {
      sql += ` AND pd.height >= $${paramIndex}`;
      params.push(filters.height_min);
      paramIndex++;
    }
    if (filters.height_max) {
      sql += ` AND pd.height <= $${paramIndex}`;
      params.push(filters.height_max);
      paramIndex++;
    }
    if (filters.occupation) {
      sql += ` AND mp.occupation ILIKE $${paramIndex}`;
      params.push(`%${filters.occupation}%`);
      paramIndex++;
    }
    if (filters.sub_caste) {
      if (Array.isArray(filters.sub_caste) && filters.sub_caste.length > 0) {
        sql += ` AND u.sub_caste = ANY($${paramIndex})`;
        params.push(filters.sub_caste);
      } else {
        sql += ` AND u.sub_caste ILIKE $${paramIndex}`;
        params.push(filters.sub_caste);
      }
      paramIndex++;
    }
    if (filters.marital_status) {
      sql += ` AND pd.marital_status ILIKE $${paramIndex}`;
      params.push(filters.marital_status);
      paramIndex++;
    }
    if (filters.education) {
      sql += ` AND (mp.highest_degree ILIKE $${paramIndex} OR mp.degree ILIKE $${paramIndex})`;
      params.push(`%${filters.education}%`);
      paramIndex++;
    }
    if (filters.manglik) {
      sql += ` AND pd.manglik ILIKE $${paramIndex}`;
      params.push(filters.manglik);
      paramIndex++;
    }
    if (filters.diet) {
      sql += ` AND pd.diet ILIKE $${paramIndex}`;
      params.push(filters.diet);
      paramIndex++;
    }

    sql += ` ORDER BY RANDOM() LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    let [rows] = await pool.execute(sql, params);

    const calculateMatch = (candidate, age) => {
      if (!preferences) return { score: 85, reasons: ["Verified Profile"] };
      let score = 50; // base score
      const reasons = [];

      // Age compatibility (+15)
      if (age && preferences.age_min && preferences.age_max) {
        if (age >= preferences.age_min && age <= preferences.age_max) {
          score += 15;
          reasons.push("Age Match");
        }
      } else {
        score += 10;
      }

      // Height compatibility (+15)
      const cHeight = parseFloat(candidate.height || 0);
      if (cHeight > 0 && preferences.height_min && preferences.height_max) {
        if (cHeight >= preferences.height_min && cHeight <= preferences.height_max) {
          score += 15;
          reasons.push("Height Match");
        }
      } else {
        score += 10;
      }

      // Marital status compatibility (+10)
      if (preferences.preferred_marital_status && candidate.marital_status) {
        if (
          preferences.preferred_marital_status.toLowerCase() === "any" ||
          preferences.preferred_marital_status.toLowerCase() === String(candidate.marital_status).toLowerCase()
        ) {
          score += 10;
          reasons.push("Marital Status Match");
        }
      }

      // Occupation / Education compatibility (+10)
      if (preferences.preferred_education && (candidate.highest_degree || candidate.degree)) {
        score += 10;
        reasons.push("Education Match");
      }

      return {
        score: Math.min(99, Math.max(60, score)),
        reasons: reasons.length > 0 ? reasons : ["Recommended Match"]
      };
    };

    const enrichProfiles = async (sourceRows) => {
      const profiles = [];
      for (const row of sourceRows || []) {
      let age = null;
      if (row.dob) {
        const dobDate = new Date(row.dob);
        const today = new Date();
        age = today.getFullYear() - dobDate.getFullYear();
      }
      delete row.dob;

      const match = calculateMatch(row, age);
        const pairRequests = await interestRepository.getPairRequests(userId, row.id);
        const accepted = pairRequests.some((request) => request.status === "accepted");
        const pendingRequest = pairRequests.find((request) => request.status === "pending");
        const rejectedRequest = pairRequests.find((request) => request.status === "rejected");
        const relationshipStatus = accepted
          ? "accepted"
          : pendingRequest
            ? "pending"
            : rejectedRequest
              ? "rejected"
              : "none";
        const requestDirection = pendingRequest
          ? (parseInt(pendingRequest.from_user, 10) === parseInt(userId, 10) ? "outgoing" : "incoming")
          : null;
        const canSendRequest = !accepted &&
          !pendingRequest &&
          !pairRequests.some((request) =>
            request.status === "rejected" &&
            parseInt(request.from_user, 10) === parseInt(userId, 10)
          );
        profiles.push({
        ...row,
        city: row.city || row.work_city || "",
        age,
        is_shortlisted: shortlistedIds.has(row.id),
        match_score: match.score,
          match_reasons: match.reasons,
          relationship_status: relationshipStatus,
          request_direction: requestDirection,
          request_id: pendingRequest ? pendingRequest.id : null,
          can_send_request: canSendRequest
        });
      }
      return profiles;
    };

    let profiles = await enrichProfiles(rows);

    if (profiles.length === 0) {
      // Clear old profile views if no new profiles match (fallback refresh)
      await pool.execute("DELETE FROM profile_views WHERE user_id = $1", [userId]);
      const [retryRows] = await pool.execute(sql, params);
      profiles = await enrichProfiles(retryRows);
    }

    return {
      success: 1,
      data: {
        page,
        total: profiles.length,
        profiles
      }
    };
  }

  async reportUser(fromUserId, toUserId, reason) {
    if (!reason) {
      return { success: 0, message: "Reason for reporting is required" };
    }

    await userRepository.ensureReportTable();
    const existingCount = await userRepository.getReportsCount(fromUserId, toUserId);
    if (existingCount > 0) {
      return { success: 0, message: "You already reported this user" };
    }

    await userRepository.createReport(fromUserId, toUserId, reason);

    return {
      success: 1,
      message: "Thanks for reporting. We’ll review this profile shortly."
    };
  }
}

module.exports = new UserService();
