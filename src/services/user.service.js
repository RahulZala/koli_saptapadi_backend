const pool = require("../config/database");
const userRepository = require("../repositories/user.repository");

class UserService {
  async getDashboardProfiles(userId, filters = {}, page = 1, limit = 20) {
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [userRows] = await pool.execute(
      "SELECT gender FROM users WHERE id = $1",
      [userId]
    );

    if (userRows.length === 0) {
      return { success: 0, message: "User not found" };
    }

    const gender = userRows[0].gender;
    const oppositeGender = gender === "male" ? "female" : "male";

    let sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.sub_caste, u.dob,
        pd.height, pd.weight,
        mp.occupation, mp.work_city,
        up.profile
      FROM users u
      LEFT JOIN physical_details pd ON pd.user_id = u.id
      LEFT JOIN marital_professional_details mp ON mp.user_id = u.id
      LEFT JOIN user_addresses ua ON ua.user_id = u.id AND ua.address_type = 'current'
      LEFT JOIN user_document up ON up.user_id = u.id 
      WHERE u.gender = $1
        AND u.is_verified = 1
        AND u.document = 1
        AND u.id != $2
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
      sql += ` AND ua.city = $${paramIndex}`;
      params.push(filters.city);
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
      sql += ` AND mp.occupation = $${paramIndex}`;
      params.push(filters.occupation);
      paramIndex++;
    }

    sql += ` ORDER BY RANDOM() LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    let [rows] = await pool.execute(sql, params);

    let profiles = rows.map((row) => {
      let age = null;
      if (row.dob) {
        const dobDate = new Date(row.dob);
        const today = new Date();
        age = today.getFullYear() - dobDate.getFullYear();
      }
      delete row.dob;
      return { ...row, age };
    });

    if (profiles.length === 0) {
      // Clear old profile views if no new profiles match
      await pool.execute("DELETE FROM profile_views WHERE user_id = $1", [userId]);
      const [retryRows] = await pool.execute(sql, params);
      profiles = retryRows.map((row) => {
        let age = null;
        if (row.dob) {
          const dobDate = new Date(row.dob);
          const today = new Date();
          age = today.getFullYear() - dobDate.getFullYear();
        }
        delete row.dob;
        return { ...row, age };
      });
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

    const existingCount = await userRepository.getReportsCount(fromUserId, toUserId);
    if (existingCount > 0) {
      return { success: 0, message: "You already reported this user" };
    }

    await userRepository.createReport(fromUserId, toUserId, reason);
    const totalReports = await userRepository.getTotalReportsAgainstUser(toUserId);

    if (totalReports > 4) {
      await userRepository.deactivateUser(toUserId);
    }

    return {
      success: 1,
      message: "Thanks for reporting. We’ll review this profile shortly."
    };
  }
}

module.exports = new UserService();
