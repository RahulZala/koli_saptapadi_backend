const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const userRepository = require("../repositories/user.repository");
const subscriptionRepository = require("../repositories/subscription.repository");
const { getExpiryDateTimeMinutes } = require("../utils/dates");
const aisensyService = require("./aisensy.service");
// [OLD CODE - Wakit WhatsApp Service - COMMENTED OUT]
// const wakitService = require("./wakit.service");

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      return { success: 0, message: "Email and password are required" };
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { success: 0, message: "Invalid email or password" };
    }

    // Verify bcrypt password hash compatible with PHP password_hash()
    let isValid = false;
    if (user.password) {
      // Replace PHP's $2y$ prefix with $2a$ for bcryptjs compatibility if needed
      const normalizedHash = user.password.replace(/^\$2y\$/, "$2a$");
      isValid = await bcrypt.compare(password, normalizedHash);
    }

    if (!isValid) {
      return { success: 0, message: "Invalid email or password" };
    }

    if (!user.is_active) {
      return { success: 0, message: "Your account is deactivated. Please contact support." };
    }

    delete user.password;
    return {
      success: 1,
      message: "Login successful",
      data: user
    };
  }

  async sendOTP(phone) {
    if (!phone) {
      return { success: 0, message: "Phone number required" };
    }

    // Validate that number is an Indian (+91) mobile number
    const validation = aisensyService.validateAndFormatIndianNumber(phone);
    if (!validation.valid) {
      return {
        success: 0,
        message: validation.message || "Only Indian mobile numbers (+91) are supported"
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = getExpiryDateTimeMinutes(5);

    // Save OTP to database
    await userRepository.createOTP(phone, otp, expiresAt);

    // Send OTP via AiSensy WhatsApp Platform (template: new_auth)
    const aisensyRes = await aisensyService.sendOTP(phone, otp);

    // [OLD CODE - Wakit WhatsApp Gateway - COMMENTED OUT]
    // await wakitService.sendOTP(phone, otp);

    return {
      success: 1,
      message: "OTP sent successfully",
      data: {
        otp,
        whatsapp_status: aisensyRes.success ? "sent" : "failed",
        whatsapp_message: aisensyRes.message
      }
    };
  }

  async verifyOTP(phone, otp) {
    if (!phone || !otp) {
      return { success: 0, message: "Phone and OTP are required" };
    }

    const record = await userRepository.findLatestOTP(phone, otp);
    if (!record) {
      return { success: 0, message: "Invalid OTP" };
    }

    const now = Date.now();
    let expiryTime;
    if (record.expires_at instanceof Date) {
      expiryTime = record.expires_at.getTime();
    } else {
      const expStr = String(record.expires_at).trim();
      const isoStr = expStr.includes("T") ? expStr : expStr.replace(" ", "T");
      expiryTime = new Date(isoStr.endsWith("Z") ? isoStr : isoStr + "Z").getTime();
    }

    if (expiryTime < now) {
      return { success: 0, message: "OTP expired" };
    }

    await userRepository.markOTPUsed(record.id);

    let user = await userRepository.findByPhone(phone);
    let userId;

    if (user) {
      userId = user.id;
      if (!user.is_active) {
        return { success: 0, message: "Your account is deactivated. Please contact support 9760975757." };
      }
    } else {
      userId = await userRepository.createUserFromPhone(phone);
      // Auto-assign 7 day trial subscription
      await subscriptionRepository.createTrialSubscription(userId);
    }

    const token = crypto.randomBytes(32).toString("hex");
    await userRepository.updateTokenAndVerify(userId, token);

    const profileService = require("./profile.service");
    const profileCompletion = await profileService.getProfileCompletion(userId);

    return {
      success: 1,
      message: "OTP verified successfully",
      data: {
        user_id: userId,
        token,
        profile_completion: profileCompletion
      }
    };
  }

  async logout(userId) {
    await userRepository.clearTokens(userId);
    return { success: 1, message: "User logged out successfully" };
  }

  async deleteAccount(userId) {
    await userRepository.deactivateUser(userId);
    return { success: 1, message: "User account deleted successfully" };
  }
}

module.exports = new AuthService();
