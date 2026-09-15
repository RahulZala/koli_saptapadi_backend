const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const userRepository = require("../repositories/user.repository");
const subscriptionRepository = require("../repositories/subscription.repository");
const { getExpiryDateTimeMinutes } = require("../utils/dates");

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      return { success: false, message: "Email and password are required" };
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { success: false, message: "Invalid email or password" };
    }

    // Verify bcrypt password hash compatible with PHP password_hash()
    let isValid = false;
    if (user.password) {
      // Replace PHP's $2y$ prefix with $2a$ for bcryptjs compatibility if needed
      const normalizedHash = user.password.replace(/^\$2y\$/, "$2a$");
      isValid = await bcrypt.compare(password, normalizedHash);
    }

    if (!isValid) {
      return { success: false, message: "Invalid email or password" };
    }

    if (parseInt(user.is_active, 10) === 0) {
      return { success: false, message: "Your account is deactivated. Please contact support." };
    }

    delete user.password;
    return {
      success: true,
      message: "Login successful",
      data: user
    };
  }

  async sendOTP(phone) {
    if (!phone) {
      return { success: false, message: "Phone number required" };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = getExpiryDateTimeMinutes(5);

    await userRepository.createOTP(phone, otp, expiresAt);
    return {
      success: true,
      message: "OTP sent successfully",
      data: { otp }
    };
  }

  async verifyOTP(phone, otp) {
    if (!phone || !otp) {
      return { success: false, message: "Phone and OTP are required" };
    }

    const record = await userRepository.findLatestOTP(phone, otp);
    if (!record) {
      return { success: false, message: "Invalid OTP" };
    }

    const now = new Date();
    const expiryDate = new Date(record.expires_at);
    if (expiryDate < now) {
      return { success: false, message: "OTP expired" };
    }

    await userRepository.markOTPUsed(record.id);

    let user = await userRepository.findByPhone(phone);
    let userId;

    if (user) {
      userId = user.id;
      if (parseInt(user.is_active, 10) === 0) {
        return { success: false, message: "Your account is deactivated. Please contact support 9760975757." };
      }
    } else {
      userId = await userRepository.createUserFromPhone(phone);
      // Auto-assign 7 day trial subscription
      await subscriptionRepository.createTrialSubscription(userId);
    }

    const token = crypto.randomBytes(32).toString("hex");
    await userRepository.updateTokenAndVerify(userId, token);

    return {
      success: true,
      message: "OTP verified successfully",
      data: {
        user_id: userId,
        token
      }
    };
  }

  async logout(userId) {
    await userRepository.clearTokens(userId);
    return { success: true, message: "User logged out successfully" };
  }

  async deleteAccount(userId) {
    await userRepository.deactivateUser(userId);
    return { success: true, message: "User account deleted successfully" };
  }
}

module.exports = new AuthService();
