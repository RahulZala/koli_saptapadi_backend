const profileViewsRepository = require("../repositories/profile-views.repository");
const interestRepository = require("../repositories/interest.repository");

class ProfileViewsService {
  async getViewers(userId, page = 1, limit = 20) {
    const activeSub = await interestRepository.getActiveSubscription(userId);
    const isPremium = Boolean(activeSub && activeSub.remaining_interests > 0);

    const rawData = await profileViewsRepository.getViewersList(userId, page, limit);

    const formattedViewers = rawData.viewers.map((v) => {
      let age = null;
      if (v.dob) {
        const dobDate = new Date(v.dob);
        const today = new Date();
        age = today.getFullYear() - dobDate.getFullYear();
      }

      if (!isPremium) {
        // Mask viewer details for non-paying users
        const maskedFirst = v.first_name ? `${v.first_name[0]}***` : "Anonymous";
        const maskedLast = v.last_name ? `${v.last_name[0]}***` : "";
        return {
          user_id: v.user_id,
          name: `${maskedFirst} ${maskedLast}`.trim(),
          sub_caste: v.sub_caste,
          work_city: v.work_city,
          age,
          profile: null, // photo locked for free users
          is_verified: v.is_verified,
          viewed_at: v.viewed_at,
          is_locked: true
        };
      }

      return {
        user_id: v.user_id,
        name: `${v.first_name} ${v.last_name}`.trim(),
        sub_caste: v.sub_caste,
        work_city: v.work_city,
        age,
        profile: v.profile,
        is_verified: v.is_verified,
        viewed_at: v.viewed_at,
        is_locked: false
      };
    });

    return {
      success: 1,
      data: {
        total_views: rawData.total_views,
        page: rawData.page,
        is_premium: isPremium,
        upgrade_prompt: !isPremium ? "Upgrade to Prime to reveal full profile identities of who viewed you" : null,
        viewers: formattedViewers
      }
    };
  }
}

module.exports = new ProfileViewsService();
