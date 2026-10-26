const kundliRepository = require("../repositories/kundli.repository");

class KundliService {
  async getKundli(userId, targetUserId = null) {
    const profileId = targetUserId || userId;
    const kundli = await kundliRepository.getKundli(profileId);
    return {
      success: 1,
      data: kundli || {
        birth_time: "",
        birth_place: "",
        rashi: "",
        nakshatra: "",
        gotra: "",
        kundli_photo_url: null,
        manglik: "dont_know"
      }
    };
  }

  async saveKundli(userId, data) {
    await kundliRepository.saveKundli(userId, data);
    return {
      success: 1,
      message: "Kundli and horoscope details saved successfully"
    };
  }

  calculateCompatibility(userKundli, partnerKundli) {
    let score = 70; // baseline compatibility
    const remarks = [];

    if (userKundli?.manglik && partnerKundli?.manglik) {
      if (userKundli.manglik === partnerKundli.manglik) {
        score += 15;
        remarks.push("Manglik Dosha Compatible");
      } else if (userKundli.manglik === "yes" && partnerKundli.manglik === "no") {
        score -= 10;
        remarks.push("Manglik Status Differs");
      }
    }

    if (userKundli?.gotra && partnerKundli?.gotra) {
      if (String(userKundli.gotra).toLowerCase().trim() !== String(partnerKundli.gotra).toLowerCase().trim()) {
        score += 15;
        remarks.push("Gotra Exogamy Matched");
      }
    }

    return {
      score: Math.min(99, Math.max(50, score)),
      remarks
    };
  }
}

module.exports = new KundliService();
