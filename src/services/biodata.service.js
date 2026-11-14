const pool = require("../config/database");
const interestRepository = require("../repositories/interest.repository");
const privacyRepository = require("../repositories/privacy.repository");
const blockRepository = require("../repositories/block.repository");

class BiodataService {
  async generateBiodata(userId, targetUserId = null) {
    const profileId = parseInt(targetUserId || userId, 10);
    if (!profileId || profileId <= 0) {
      return { success: 0, message: "A valid profile ID is required" };
    }

    const isSelf = parseInt(userId, 10) === profileId;
    if (!isSelf && await blockRepository.isBlockedBetween(userId, profileId)) {
      return { success: 0, message: "This profile is unavailable" };
    }
    const [pairRequests, privacy] = await Promise.all([
      isSelf ? [] : interestRepository.getPairRequests(userId, profileId),
      privacyRepository.getPrivacySettings(profileId)
    ]);
    const accepted = isSelf || pairRequests.some((request) => request.status === "accepted");
    if (!isSelf && (!accepted || privacy.profile_status !== "active")) {
      return { success: 0, message: "Biodata is available after the profile request is accepted" };
    }
    const canViewPhone = isSelf ||
      privacy.phone_visibility === "public" ||
      (accepted && ["on_accept", "request_only"].includes(privacy.phone_visibility));
    const canViewEmail = isSelf || accepted;
    const canViewPhotos = isSelf || accepted || privacy.photo_privacy === "public";
    const contactColumns = [
      canViewEmail ? "u.email" : null,
      canViewPhone ? "u.phone" : null
    ].filter(Boolean).join(", ");
    const profileColumn = canViewPhotos ? "ud.profile" : "NULL AS profile";

    const [rows] = await pool.execute(
      `SELECT 
        u.id, u.first_name, u.last_name, u.sub_caste, u.dob, u.gender,
        EXTRACT(YEAR FROM age(CURRENT_DATE, u.dob)) AS age,
        pd.height, pd.weight, pd.diet, pd.manglik, pd.marital_status, pd.languages_known,
        fd.father_name, fd.mother_name, fd.maternal_surname, fd.siblings, fd.family_type, fd.father_occupations,
        mpd.highest_degree, mpd.university_name, mpd.occupation, mpd.work_city, mpd.annual_income,
        c.name AS city,
        ${profileColumn}
        ${contactColumns ? `, ${contactColumns}` : ""}
      FROM users u
      LEFT JOIN physical_details pd ON pd.user_id = u.id
      LEFT JOIN family_details fd ON fd.user_id = u.id
      LEFT JOIN marital_professional_details mpd ON mpd.user_id = u.id
      LEFT JOIN user_addresses ua ON ua.user_id = u.id AND ua.address_type = 'current'
      LEFT JOIN cities c ON ua.city_id = c.id
      LEFT JOIN user_document ud ON ud.user_id = u.id
      WHERE u.id = $1`,
      [profileId]
    );

    if (!rows || rows.length === 0) {
      return { success: 0, message: "Profile not found" };
    }

    const p = rows[0];
    if (!canViewPhotos) p.profile = null;

    // Format professional Gujarati / Indian Matrimonial Biodata Text for WhatsApp
    const biodataText = [
      `💍 *KOLI SAPTAPADI MATRIMONIAL BIODATA* 💍`,
      `----------------------------------------`,
      `👤 *PERSONAL DETAILS*`,
      `• *Name*: ${p.first_name || ""} ${p.last_name || ""}`,
      `• *Sub-Caste*: ${p.sub_caste || "Koli"}`,
      `• *Date of Birth*: ${p.dob ? new Date(p.dob).toLocaleDateString("en-GB") : "N/A"} (${p.age || "N/A"} Yrs)`,
      `• *Height*: ${p.height ? p.height + " cm" : "N/A"} | *Weight*: ${p.weight ? p.weight + " kg" : "N/A"}`,
      `• *Marital Status*: ${p.marital_status || "Never Married"}`,
      `• *Manglik*: ${p.manglik || "No"} | *Diet*: ${p.diet || "Veg"}`,
      ``,
      `🎓 *EDUCATION & OCCUPATION*`,
      `• *Education*: ${p.highest_degree || "Graduate"} (${p.university_name || "N/A"})`,
      `• *Occupation*: ${p.occupation || "Employed"}`,
      `• *Annual Income*: ${p.annual_income || "Confidential"}`,
      `• *Work City*: ${p.work_city || "Gujarat"}`,
      ``,
      `👨‍👩‍👧 *FAMILY BACKGROUND*`,
      `• *Father's Name*: ${p.father_name || "N/A"} (${p.father_occupations || "N/A"})`,
      `• *Mother's Name*: ${p.mother_name || "N/A"}`,
      `• *Maternal Surname (Mosal)*: ${p.maternal_surname || "N/A"}`,
      `• *Family Type*: ${p.family_type || "Joint Family"}`,
      `• *Siblings*: ${p.siblings !== undefined && p.siblings !== null ? p.siblings : "N/A"}`,
      ``,
      `📍 *RESIDENCE & CONTACT*`,
      `• *City*: ${p.city || p.work_city || "Gujarat"}`,
      `• *Contact*: ${p.phone ? `+91 ${p.phone}` : "Hidden"}`,
      `----------------------------------------`,
      `✨ Verified on Koli Saptapadi Matrimony App`
    ].join("\n");

    return {
      success: 1,
      data: {
        profile_id: p.id,
        full_name: `${p.first_name} ${p.last_name}`,
        biodata_text: biodataText,
        profile_image: p.profile || null,
        formatted_data: p
      }
    };
  }
}

module.exports = new BiodataService();
