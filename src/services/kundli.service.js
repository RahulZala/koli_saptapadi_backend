const kundliRepository = require("../repositories/kundli.repository");
const interestRepository = require("../repositories/interest.repository");

class KundliService {
  async getKundli(userId, targetUserId = null) {
    const profileId = parseInt(targetUserId || userId, 10);
    const viewerId = parseInt(userId, 10);
    const isSelf = profileId === viewerId;

    if (!isSelf && !await interestRepository.hasAcceptedInterest(viewerId, profileId)) {
      return { success: 0, message: "Kundli details are available after the interest is accepted" };
    }

    const targetKundli = await kundliRepository.getKundli(profileId);
    const data = this.emptyKundli(targetKundli);

    if (isSelf) {
      return { success: 1, data };
    }

    const viewerKundli = await kundliRepository.getKundli(viewerId);
    return {
      success: 1,
      data,
      comparison: this.compareProfiles(viewerKundli, targetKundli)
    };
  }

  async saveKundli(userId, data) {
    const clean = Object.fromEntries(
      ["birth_time", "birth_place", "rashi", "nakshatra", "gotra", "kundli_photo_url"]
        .map((key) => [key, typeof data[key] === "string" ? data[key].trim() : data[key] || null])
    );
    await kundliRepository.saveKundli(userId, clean);
    return {
      success: 1,
      message: "Kundli and horoscope details saved successfully"
    };
  }

  emptyKundli(kundli) {
    return {
      birth_time: kundli?.birth_time || "",
      birth_place: kundli?.birth_place || "",
      rashi: kundli?.rashi || "",
      nakshatra: kundli?.nakshatra || "",
      gotra: kundli?.gotra || "",
      kundli_photo_url: kundli?.kundli_photo_url || null,
      manglik: kundli?.manglik || "dont_know"
    };
  }

  compareProfiles(viewerKundli, targetKundli) {
    const viewer = this.emptyKundli(viewerKundli);
    const target = this.emptyKundli(targetKundli);
    const displayValue = (kundli, field) => {
      const value = String(kundli[field] || "").trim();
      return field === "manglik" && value.toLowerCase() === "dont_know" ? "" : value;
    };
    const details = ["rashi", "nakshatra", "gotra", "manglik"].map((field) => ({
      field,
      your_value: displayValue(viewer, field),
      partner_value: displayValue(target, field)
    }));
    const viewerHasDetails = details.some((detail) => detail.your_value);
    const partnerHasDetails = details.some((detail) => detail.partner_value);
    const canCompare = viewerHasDetails && partnerHasDetails;

    return {
      available: canCompare,
      message: canCompare
        ? "Saved Kundli details are compared below. This is not a Guna Milan score."
        : "Both members need to save Kundli details before they can be compared.",
      details
    };
  }
}

module.exports = new KundliService();
