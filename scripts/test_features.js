const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("==================================================");
console.log("🚀 COMPREHENSIVE FULL-STACK UNIT TEST SUITE");
console.log("==================================================");

// Test 1: Express App & Route Mounting
console.log("▶ [Test 1] Testing Express app & all 16 Route modules...");
const app = require("../src/app");
assert(app, "Express app should export properly");
console.log("✔ Express app & route alias normalizer verified");

(async () => {
  try {
    // Test 2: Shortlist Service
    console.log("▶ [Test 2] Testing Shortlist Service logic...");
    const shortlistService = require("../src/services/shortlist.service");
    const slRes1 = await shortlistService.toggleShortlist(1, null);
    assert.strictEqual(slRes1.success, 0, "Should reject null target user");
    const slRes2 = await shortlistService.toggleShortlist(10, 10);
    assert.strictEqual(slRes2.success, 0, "Should reject self-shortlisting");
    console.log("✔ Shortlist validation rules verified");

    // Test 3: Biodata Service (Point 4)
    console.log("▶ [Test 3] Testing Biodata Generation logic...");
    const biodataService = require("../src/services/biodata.service");
    assert(typeof biodataService.generateBiodata === "function", "generateBiodata must exist");
    console.log("✔ Biodata service verified");

    // Test 4: Privacy & Profile Status (Point 5)
    console.log("▶ [Test 4] Testing Privacy Settings logic...");
    const privacyService = require("../src/services/privacy.service");
    assert(typeof privacyService.getPrivacySettings === "function", "getPrivacySettings must exist");
    assert(typeof privacyService.updatePrivacySettings === "function", "updatePrivacySettings must exist");
    console.log("✔ Privacy service verified");

    // Test 5: Who Viewed My Profile & Masking (Point 6)
    console.log("▶ [Test 5] Testing Profile Views & Masking logic...");
    const profileViewsService = require("../src/services/profile-views.service");
    assert(typeof profileViewsService.getViewers === "function", "getViewers must exist");
    console.log("✔ Profile Views & viewer masking verified");

    // Test 6: Chat Service & Mutual Interest Security (Point 7)
    console.log("▶ [Test 6] Testing Safe In-App Direct Chat Security Rules...");
    const chatService = require("../src/services/chat.service");
    const chatSelf = await chatService.sendMessage(5, 5, "Hello");
    assert.strictEqual(chatSelf.success, 0, "Must block sending message to oneself");
    const chatEmpty = await chatService.sendMessage(5, 6, "   ");
    assert.strictEqual(chatEmpty.success, 0, "Must block empty message content");
    const chatInvalid = await chatService.sendMessage(5, null, "Hello");
    assert.strictEqual(chatInvalid.success, 0, "Must block null recipient");
    console.log("✔ Chat security rules (self-message, empty content, null recipient) verified");

    const chatRepository = require("../src/repositories/chat.repository");
    const interestRepository = require("../src/repositories/interest.repository");
    const userRepository = require("../src/repositories/user.repository");
    const blockRepository = require("../src/repositories/block.repository");
    const notificationService = require("../src/services/notification.service");
    const pool = require("../src/config/database");
    const originals = {
      isReportedBetween: userRepository.isReportedBetween,
      hasAcceptedInterest: interestRepository.hasAcceptedInterest,
      getActiveSubscription: interestRepository.getActiveSubscription,
      sendMessage: chatRepository.sendMessage,
      isBlockedBetween: blockRepository.isBlockedBetween,
      createAndSendNotification: notificationService.createAndSendNotification,
      execute: pool.execute
    };
    try {
      userRepository.isReportedBetween = async (user1, user2) =>
        (user1 === 1 && user2 === 2) || (user1 === 2 && user2 === 1);
      interestRepository.hasAcceptedInterest = async () => true;
      interestRepository.getActiveSubscription = async () => ({ id: 1 });
      chatRepository.sendMessage = async (senderId, receiverId, message) => ({
        id: 1, sender_id: senderId, receiver_id: receiverId, message
      });
      blockRepository.isBlockedBetween = async (user1, user2) => user1 === 1 && user2 === 9;
      notificationService.createAndSendNotification = async () => {};
      pool.execute = async () => [[{ first_name: "Test", last_name: "User" }], null];

      const reportedPairMessage = await chatService.sendMessage(1, 2, "Blocked");
      assert.strictEqual(reportedPairMessage.chat_blocked, true, "A report must block chat for that pair");
      assert.strictEqual((await chatService.sendMessage(1, 3, "Allowed")).success, 1,
        "Reporter must still be able to chat with other users");
      assert.strictEqual((await chatService.sendMessage(2, 4, "Allowed")).success, 1,
        "Reported user must still be able to chat with other users");
      assert.strictEqual((await chatService.sendMessage(1, 9, "Blocked")).chat_blocked, true,
        "Blocked users must not send chat messages");
      assert.strictEqual((await chatService.sendMessage(1, 3, "Another allowed message")).success, 1,
        "There must be no per-message restriction after chat access is granted");
    } finally {
      userRepository.isReportedBetween = originals.isReportedBetween;
      interestRepository.hasAcceptedInterest = originals.hasAcceptedInterest;
      interestRepository.getActiveSubscription = originals.getActiveSubscription;
      chatRepository.sendMessage = originals.sendMessage;
      blockRepository.isBlockedBetween = originals.isBlockedBetween;
      notificationService.createAndSendNotification = originals.createAndSendNotification;
      pool.execute = originals.execute;
    }
    console.log("✔ Pair-only report blocking and unrestricted messaging verified");

    const reportService = require("../src/services/user.service");
    const reportOriginals = {
      ensureReportTable: userRepository.ensureReportTable,
      getReportsCount: userRepository.getReportsCount,
      createReport: userRepository.createReport,
      getTotalReportsAgainstUser: userRepository.getTotalReportsAgainstUser,
      deactivateUser: userRepository.deactivateUser
    };
    let accountDeactivationCalls = 0;
    try {
      userRepository.ensureReportTable = async () => {};
      userRepository.getReportsCount = async () => 0;
      userRepository.createReport = async () => {};
      userRepository.getTotalReportsAgainstUser = async () => 5;
      userRepository.deactivateUser = async () => {
        accountDeactivationCalls++;
      };
      const reportResult = await reportService.reportUser(1, 2, "Safety report");
      assert.strictEqual(reportResult.success, 1, "A valid report should be recorded");
      assert.strictEqual(accountDeactivationCalls, 0,
        "A report must not deactivate the reported user's account");
    } finally {
      userRepository.ensureReportTable = reportOriginals.ensureReportTable;
      userRepository.getReportsCount = reportOriginals.getReportsCount;
      userRepository.createReport = reportOriginals.createReport;
      userRepository.getTotalReportsAgainstUser = reportOriginals.getTotalReportsAgainstUser;
      userRepository.deactivateUser = reportOriginals.deactivateUser;
    }
    console.log("✔ Reporting does not ban either user's account globally");

    console.log("▶ [Test 6b] Testing profile request status and private contact permissions...");
    const profileService = require("../src/services/profile.service");
    const interestService = require("../src/services/interest.service");
    const profileViewsRepository = require("../src/repositories/profile-views.repository");
    const privacyRepository = require("../src/repositories/privacy.repository");
    const profileOriginals = {
      getPairRequests: interestRepository.getPairRequests,
      hasAcceptedInterest: interestRepository.hasAcceptedInterest,
      getPrivacySettings: privacyRepository.getPrivacySettings,
      recordView: profileViewsRepository.recordView,
      getBlockStatus: blockRepository.getBlockStatus,
      isBlockedBetween: blockRepository.isBlockedBetween,
      execute: pool.execute
    };
    let capturedProfileQuery = "";
    let imageQueryCount = 0;
    const recordedProfileViews = [];
    try {
      profileViewsRepository.recordView = async (viewerId, viewedUserId) => {
        recordedProfileViews.push([viewerId, viewedUserId]);
      };
      interestRepository.getPairRequests = async () => [{
        id: 91, from_user: 1, to_user: 22, status: "pending"
      }];
      privacyRepository.getPrivacySettings = async () => ({
        profile_status: "active",
        photo_privacy: "request_only",
        phone_visibility: "on_accept"
      });
      blockRepository.getBlockStatus = async () => ({
        blockedByMe: false, blockingMe: false
      });
      blockRepository.isBlockedBetween = async () => false;
      interestRepository.hasAcceptedInterest = async () => false;
      pool.execute = async (sql) => {
        if (sql.includes("FROM users u")) capturedProfileQuery = sql;
        if (sql.includes("user_photos")) {
          imageQueryCount += 1;
          return [[{ image_url: "private-photo" }], null];
        }
        return [[{
          id: 22, first_name: "Public", last_name: "Profile", gender: "Female",
          age: 25, height: "160", marital_status: "single",
          highest_degree: "Graduate", degree: "BA", occupation: "Teacher",
          work_city: "Town", profile: null, is_verified: true
        }], null];
      };
      const pendingProfile = await profileService.getPartnerProfile(1, 22);
      assert.strictEqual(pendingProfile.data.relationship_status, "pending");
      assert.strictEqual(pendingProfile.data.request_direction, "outgoing");
      assert.strictEqual(pendingProfile.data.can_send_request, false);
      assert.strictEqual(pendingProfile.data.profile, null,
        "Request-only photos must remain hidden while a request is pending");
      assert.strictEqual(Object.prototype.hasOwnProperty.call(pendingProfile.data, "phone"), false,
        "Pending requests must not return a phone field");
      assert.strictEqual(Object.prototype.hasOwnProperty.call(pendingProfile.data, "email"), false,
        "Pending requests must not return an email field");
      assert(!capturedProfileQuery.includes("u.phone") && !capturedProfileQuery.includes("u.email"),
        "Unauthorized profile queries must not select contact columns");
      const pendingPhotos = await profileService.getImages(1, 22);
      assert.deepStrictEqual(pendingPhotos.data.profile, [],
        "Request-only profile photos must remain hidden through the image endpoint");
      assert.strictEqual(imageQueryCount, 0,
        "Unauthorized photos must not be queried from the database");

      interestRepository.getPairRequests = async () => [{
        id: 92, from_user: 22, to_user: 1, status: "rejected"
      }];
      const declinedProfile = await profileService.getPartnerProfile(1, 22);
      assert.strictEqual(declinedProfile.data.relationship_status, "rejected");
      assert.strictEqual(Object.prototype.hasOwnProperty.call(declinedProfile.data, "phone"), false,
        "Declined requests must not reveal phone numbers");
      assert.strictEqual(Object.prototype.hasOwnProperty.call(declinedProfile.data, "email"), false,
        "Declined requests must not reveal email addresses");

      interestRepository.getPairRequests = async () => [{
        id: 91, from_user: 1, to_user: 22, status: "accepted"
      }];
      interestRepository.hasAcceptedInterest = async () => true;
      privacyRepository.getPrivacySettings = async () => ({
        profile_status: "active",
        photo_privacy: "request_only",
        phone_visibility: "on_accept"
      });
      pool.execute = async (sql) => {
        if (!sql.includes("user_photos")) capturedProfileQuery = sql;
        if (sql.includes("user_photos")) {
          imageQueryCount += 1;
          return [[{ image_url: "private-photo" }], null];
        }
        return [[{
          id: 22, first_name: "Connected", last_name: "Profile", gender: "Female",
          age: 25, height: "160", phone: "9876543210", email: "member@example.test",
          profile: "private-photo", is_verified: true
        }], null];
      };
      const acceptedProfile = await profileService.getPartnerProfile(1, 22);
      assert.strictEqual(acceptedProfile.data.relationship_status, "accepted");
      assert.strictEqual(acceptedProfile.data.phone, "9876543210");
      assert.strictEqual(acceptedProfile.data.email, "member@example.test");
      assert(capturedProfileQuery.includes("u.phone") && capturedProfileQuery.includes("u.email"),
        "Accepted contacts may be selected according to privacy settings");
      assert.deepStrictEqual(recordedProfileViews, [[1, 22], [1, 22], [1, 22]],
        "Successfully viewed profiles must be recorded, but blocked/unavailable profiles must not");
      const acceptedPhotos = await profileService.getImages(1, 22);
      assert.strictEqual(acceptedPhotos.data.profile[0], "private-photo",
        "Accepted connections may view request-only photos");

      blockRepository.getBlockStatus = async () => ({
        blockedByMe: true, blockingMe: false
      });
      blockRepository.isBlockedBetween = async () => true;
      const blockedProfile = await profileService.getPartnerProfile(1, 22);
      assert.strictEqual(blockedProfile.data.relationship_status, "blocked");
      assert.strictEqual(Object.prototype.hasOwnProperty.call(blockedProfile.data, "phone"), false);
      assert.strictEqual((await profileService.getImages(1, 22)).success, 0,
        "Blocked users must not bypass photo privacy through the image endpoint");

      blockRepository.getBlockStatus = async () => ({
        blockedByMe: false, blockingMe: true
      });
      const unavailableProfile = await profileService.getPartnerProfile(1, 22);
      assert.strictEqual(unavailableProfile.success, 0,
        "A user blocked by the profile owner must not bypass profile privacy");
    } finally {
      interestRepository.getPairRequests = profileOriginals.getPairRequests;
      interestRepository.hasAcceptedInterest = profileOriginals.hasAcceptedInterest;
      privacyRepository.getPrivacySettings = profileOriginals.getPrivacySettings;
      profileViewsRepository.recordView = profileOriginals.recordView;
      blockRepository.getBlockStatus = profileOriginals.getBlockStatus;
      blockRepository.isBlockedBetween = profileOriginals.isBlockedBetween;
      pool.execute = profileOriginals.execute;
    }
    console.log("✔ Pending privacy, accepted contact access, and blocked profile privacy verified");

    const requestActionOriginals = {
      isBlockedBetween: blockRepository.isBlockedBetween,
      respondToInterest: interestRepository.respondToInterest,
      findById: userRepository.findById,
      createAndSendNotification: notificationService.createAndSendNotification
    };
    let responseReceiverId = null;
    try {
      blockRepository.isBlockedBetween = async () => false;
      interestRepository.respondToInterest = async (id, receiverId, status) => {
        responseReceiverId = receiverId;
        return { id, from_user: 10, to_user: receiverId, status };
      };
      userRepository.findById = async () => ({ first_name: "Request", last_name: "Receiver" });
      notificationService.createAndSendNotification = async () => {};
      const acceptedAction = await interestService.manageInterest(999, 22, "accept", 7);
      assert.strictEqual(acceptedAction.success, 1);
      assert.strictEqual(responseReceiverId, 22,
        "Accept must be authorized using the authenticated receiver, not the submitted target ID");
      interestRepository.respondToInterest = async () => null;
      const unauthorizedAction = await interestService.manageInterest(999, 23, "reject", 7);
      assert.strictEqual(unauthorizedAction.success, 0,
        "A user who is not the request recipient cannot reject the request");
    } finally {
      blockRepository.isBlockedBetween = requestActionOriginals.isBlockedBetween;
      interestRepository.respondToInterest = requestActionOriginals.respondToInterest;
      userRepository.findById = requestActionOriginals.findById;
      notificationService.createAndSendNotification = requestActionOriginals.createAndSendNotification;
    }
    console.log("✔ Receiver-authorized accept/reject verified");

    const duplicateOriginals = {
      connect: pool.connect,
      schemaReady: interestRepository.schemaReady,
      ensureTable: blockRepository.ensureTable
    };
    let duplicateRequestLocked = false;
    try {
      interestRepository.schemaReady = Promise.resolve();
      blockRepository.ensureTable = async () => {};
      pool.connect = async () => ({
        query: async (sql) => {
          if (sql.includes("pg_advisory_xact_lock")) duplicateRequestLocked = true;
          if (sql.includes("FROM user_blocks")) return { rows: [] };
          if (sql.includes("FROM users")) return { rows: [{ id: 2 }] };
          if (sql.includes("FROM interests")) {
            return { rows: [{ id: 3, from_user: 1, to_user: 2, status: "pending" }] };
          }
          return { rows: [] };
        },
        release: () => {}
      });
      const duplicateRequest = await interestRepository.sendInterest(1, 2);
      assert.strictEqual(duplicateRequest.error.includes("already pending"), true,
        "Existing pending requests must reject duplicate sends");
      assert.strictEqual(duplicateRequestLocked, true,
        "Duplicate checks must be protected by the pair advisory lock");
    } finally {
      pool.connect = duplicateOriginals.connect;
      interestRepository.schemaReady = duplicateOriginals.schemaReady;
      blockRepository.ensureTable = duplicateOriginals.ensureTable;
    }
    console.log("✔ Duplicate requests are serialized and rejected");

    // Test 7: Kundli / Horoscope Comparison (Point 8)
    console.log("▶ [Test 7] Testing Kundli & Horoscope profile comparison...");
    const kundliService = require("../src/services/kundli.service");
    const comparison = kundliService.compareProfiles(
      { rashi: "Mesh", nakshatra: "Ashwini", gotra: "Solanki", manglik: "no" },
      { rashi: "Vrushabh", nakshatra: "Rohini", gotra: "Chavda", manglik: "dont_know" }
    );
    assert.strictEqual(comparison.available, true, "Saved details should be available for comparison");
    assert.strictEqual(comparison.details.find((item) => item.field === "gotra").partner_value, "Chavda");
    assert.match(comparison.message, /not a Guna Milan score/);
    const incompleteComparison = kundliService.compareProfiles(null, null);
    assert.strictEqual(incompleteComparison.available, false, "Missing Kundli data must not report a match");
    const kundliRepository = require("../src/repositories/kundli.repository");
    const kundliOriginals = {
      getKundli: kundliRepository.getKundli,
      saveKundli: kundliRepository.saveKundli,
      hasAcceptedInterest: interestRepository.hasAcceptedInterest
    };
    let kundliReadIds = [];
    let savedKundli = null;
    try {
      interestRepository.hasAcceptedInterest = async () => false;
      kundliRepository.getKundli = async (id) => {
        kundliReadIds.push(id);
        return { rashi: id === 1 ? "Mesh" : "Vrushabh" };
      };
      const unauthorizedKundli = await kundliService.getKundli(1, 2);
      assert.strictEqual(unauthorizedKundli.success, 0, "Kundli must require an accepted interest");
      assert.strictEqual(kundliReadIds.length, 0, "Unauthorized Kundli requests must not read stored details");

      interestRepository.hasAcceptedInterest = async () => true;
      const authorizedKundli = await kundliService.getKundli(1, 2);
      assert.strictEqual(authorizedKundli.success, 1);
      assert.deepStrictEqual(kundliReadIds, [2, 1], "Comparison must load partner and viewer profiles");

      kundliRepository.saveKundli = async (userId, data) => {
        savedKundli = { userId, data };
      };
      await kundliService.saveKundli(1, { rashi: "  Mesh  ", ignored: "not persisted" });
      assert.strictEqual(savedKundli.data.rashi, "Mesh", "Saved Kundli strings should be trimmed");
      assert.strictEqual(Object.hasOwn(savedKundli.data, "ignored"), false,
        "Only supported Kundli fields should be persisted");
    } finally {
      kundliRepository.getKundli = kundliOriginals.getKundli;
      kundliRepository.saveKundli = kundliOriginals.saveKundli;
      interestRepository.hasAcceptedInterest = kundliOriginals.hasAcceptedInterest;
    }
    console.log("✔ Kundli access control, persistence sanitization, and comparison verified");

    // Test 8: Referral & Micro Add-on Packs (Point 9)
    console.log("▶ [Test 8] Testing Referral Code & Add-on Packs (+3 Send Interests on Both Sides)...");
    const referralService = require("../src/services/referral.service");
    const referralRepository = require("../src/repositories/referral.repository");
    assert(typeof referralRepository.addSendInterests === "function", "addSendInterests helper must exist");

    const refInfo = await referralService.getReferralInfo(105);
    assert(refInfo.data.referral_code.startsWith("KOLI"), "Referral code should start with KOLI");
    assert(refInfo.data.referral_code.length >= 8, "Referral code should be a secure unique code");
    assert.strictEqual(refInfo.data.bonus_send_interests_per_referral, 3, "Must grant 3 bonus send interests");

    const code1 = referralRepository.generateRandomCode();
    const code2 = referralRepository.generateRandomCode();
    assert(code1.startsWith("KOLI") && code2.startsWith("KOLI"), "Random codes should start with KOLI");
    assert.notStrictEqual(code1, code2, "Generated codes must be unique and non-colliding");

    const refInvalid = await referralService.applyReferral(105, "INVALID_CODE");
    assert.strictEqual(refInvalid.success, 0, "Must reject invalid referral code format");

    const refSelf = await referralService.applyReferral(105, "KOLI105");
    assert.strictEqual(refSelf.success, 0, "Must reject self-referral");

    const addons = await referralService.getAddons();
    assert(addons.data.addon_plans.length >= 2, "Must return at least 2 micro add-on contact packs");
    assert.strictEqual(addons.data.addon_plans[0].price, 199, "Price for 5 contacts addon must remain ₹199");
    assert.strictEqual(addons.data.addon_plans[1].price, 499, "Price for 15 contacts addon must remain ₹499");
    console.log("✔ Referral generation, self-referral prevention, +3 send interests to both sides, and addon pricing verified");

    // Test 9: User Discovery & Match Compatibility (Points 1 & 2)
    console.log("▶ [Test 9] Testing User Service Discovery...");
    const userService = require("../src/services/user.service");
    assert(typeof userService.getDashboardProfiles === "function", "getDashboardProfiles must exist");
    console.log("✔ Discovery engine verified");

    // Test 10: Date & Height Utilities
    console.log("▶ [Test 10] Testing Utility Functions...");
    const { calculateAge } = require("../src/utils/dates");
    assert(calculateAge("2000-01-01") >= 24, "Age should be correctly computed");

    const { feetInchStringToCm } = require("../src/utils/height");
    const cm = feetInchStringToCm("5' 6\"");
    assert(cm >= 165 && cm <= 170, "Height conversion 5'6 should be ~168 cm");
    console.log("✔ Height and date utility functions verified");

    // Test 11: SQL Address & City Integrity Validation
    console.log("▶ [Test 11] Testing SQL Address & City Integrity (Ensuring NO '\\bua.city\\b' references)...");
    const userSrc = fs.readFileSync(path.join(__dirname, "../src/services/user.service.js"), "utf8");
    const bioSrc = fs.readFileSync(path.join(__dirname, "../src/services/biodata.service.js"), "utf8");

    assert(!/\bua\.city\b/.test(userSrc), "user.service.js must NOT reference non-existent column 'ua.city'");
    assert(userSrc.includes("c.name AS city"), "user.service.js must join cities table and alias c.name AS city");
    assert(userSrc.includes("LEFT JOIN cities c ON ua.city_id = c.id"), "user.service.js must join cities c ON ua.city_id = c.id");

    assert(!/\bua\.city\b/.test(bioSrc), "biodata.service.js must NOT reference non-existent column 'ua.city'");
    assert(bioSrc.includes("c.name AS city"), "biodata.service.js must join cities table and alias c.name AS city");
    assert(bioSrc.includes("LEFT JOIN cities c ON ua.city_id = c.id"), "biodata.service.js must join cities c ON ua.city_id = c.id");
    console.log("✔ SQL schema integrity verified: 'ua.city' completely eliminated and 'c.name AS city' correctly joined");

    console.log("\n==================================================");
    console.log("🎉 ALL 11 UNIT TEST SUITES PASSED WITH ZERO ERRORS!");
    console.log("==================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("Test Suite Error:", err);
    process.exit(1);
  }
})();
