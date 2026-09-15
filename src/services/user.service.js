const pool = require("../config/database");
const userRepository = require("../repositories/user.repository");

class UserService {
  async getDashboardProfiles(userId, filters = {}, page = 1, limit = 20) {
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [userRows] = await pool.execute(
      "SELECT gender FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return { success: false, message: "User not found" };
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
      WHERE u.gender = ?
        AND u.is_verified = 1
        AND u.document = 1
        AND u.id != ?
        AND NOT EXISTS (
          SELECT 1 FROM interests i
          WHERE i.from_user = ? AND i.to_user = u.id
          AND (
            i.status != 'rejected'
            OR (i.status = 'rejected' AND i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM profile_views pv
          WHERE pv.user_id = ? AND pv.viewed_user_id = u.id
          AND pv.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        )
    `;

    const params = [oppositeGender, userId, userId, userId];

    if (filters.age_min) {
      sql += " AND u.dob <= DATE_SUB(CURDATE(), INTERVAL ? YEAR)";
      params.push(filters.age_min);
    }
    if (filters.age_max) {
      sql += " AND u.dob >= DATE_SUB(CURDATE(), INTERVAL ? YEAR)";
      params.push(filters.age_max);
    }
    if (filters.city) {
      sql += " AND ua.city = ?";
      params.push(filters.city);
    }
    if (filters.height_min) {
      sql += " AND pd.height >= ?";
      params.push(filters.height_min);
    }
    if (filters.height_max) {
      sql += " AND pd.height <= ?";
      params.push(filters.height_max);
    }
    if (filters.occupation) {
      sql += " AND mp.occupation = ?";
      params.push(filters.occupation);
    }

    sql += " ORDER BY RAND() LIMIT ? OFFSET ?";
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
      await pool.execute("DELETE FROM profile_views WHERE user_id = ?", [userId]);
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
      success: true,
      data: {
        page,
        total: profiles.length,
        profiles
      }
    };
  }

  async reportUser(fromUserId, toUserId, reason) {
    if (!reason) {
      return { success: false, message: "Reason for reporting is required" };
    }

    const existingCount = await userRepository.getReportsCount(fromUserId, toUserId);
    if (existingCount > 0) {
      return { success: false, message: "You already reported this user" };
    }

    await userRepository.createReport(fromUserId, toUserId, reason);
    const totalReports = await userRepository.getTotalReportsAgainstUser(toUserId);

    if (totalReports > 4) {
      await userRepository.deactivateUser(toUserId);
    }

    return {
      success: true,
      message: "Thanks for reporting. We’ll review this profile shortly."
    };
  }
}

module.exports = new UserService();
