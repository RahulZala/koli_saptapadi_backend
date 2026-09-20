const env = require("../config/env");

class WakitService {
  get baseUrl() {
    return (env.WAKIT_BASE_URL || "https://wakit.in/api/v1").replace(/\/+$/, "");
  }

  get apiKey() {
    return env.WAKIT_API_KEY || "";
  }

  /**
   * Formats phone number to E.164 international format (+919876543210)
   * Default country code is +91 (India)
   */
  formatE164(phone) {
    if (!phone) return "";
    let cleaned = String(phone).trim().replace(/[^\d+]/g, "");

    // If it starts with +91, return as is
    if (cleaned.startsWith("+91")) {
      return cleaned;
    }

    // If it starts with + but not 91
    if (cleaned.startsWith("+")) {
      return cleaned;
    }

    // If it starts with 91 and is 12 digits long
    if (cleaned.startsWith("91") && cleaned.length === 12) {
      return `+${cleaned}`;
    }

    // If it starts with 0 and is 11 digits
    if (cleaned.startsWith("0") && cleaned.length === 11) {
      return `+91${cleaned.substring(1)}`;
    }

    // Default: 10-digit Indian phone number
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }

    // Fallback if digits present
    return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  }

  /**
   * Normalizes phone number to 10-digit raw format (e.g. 9876543210) for database storage and queries
   */
  normalize10Digits(phone) {
    if (!phone) return "";
    let cleaned = String(phone).trim().replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      return cleaned.substring(2);
    }
    if (cleaned.length === 11 && cleaned.startsWith("0")) {
      return cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Check if Wakit service is configured with an API key
   */
  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim() !== "");
  }

  /**
   * Send OTP via Wakit WhatsApp Gateway
   * @param {string} phone - Target phone number
   * @returns {Promise<{success: boolean, id?: string, to?: string, channel?: string, message?: string, raw?: any}>}
   */
  async sendOTP(phone, otp) {
    const to = this.formatE164(phone);
    if (!to) {
      return { success: false, message: "Valid phone number is required" };
    }

    if (!this.isConfigured()) {
      return { success: false, message: "Wakit API key not configured" };
    }

    const endpoint = `${this.baseUrl}/otp/send`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey.trim()}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ to })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          id: data.data?.id,
          to: data.data?.to || to,
          status: data.data?.status || "sent",
          channel: data.data?.channel || "whatsapp",
          expires_at: data.data?.expires_at,
          created_at: data.data?.created_at,
          raw: data.data
        };
      }

      const errorMessage =
        data.error?.message ||
        (data.error?.fields ? Object.values(data.error.fields).flat().join(", ") : null) ||
        data.message ||
        `Wakit send OTP failed with status ${response.status}`;

      return {
        success: false,
        status: response.status,
        message: errorMessage,
        raw: data
      };
    } catch (err) {
      return {
        success: false,
        message: `Wakit connection error: ${err.message}`
      };
    }
  }

  /**
   * Verify OTP via Wakit API
   * @param {string} phone - Target phone number
   * @param {string|number} code - OTP code entered by user
   * @returns {Promise<{success: boolean, verified: boolean, id?: string, to?: string, message?: string, raw?: any}>}
   */
  async verifyOTP(phone, code) {
    const to = this.formatE164(phone);
    const otpCode = String(code || "").trim();

    if (!to || !otpCode) {
      return { success: false, verified: false, message: "Phone and OTP code are required" };
    }

    if (!this.isConfigured()) {
      return { success: false, verified: false, message: "Wakit API key not configured" };
    }

    const endpoint = `${this.baseUrl}/otp/verify`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey.trim()}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          to,
          code: otpCode
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const isVerified = Boolean(data.data?.verified === true);
        return {
          success: true,
          verified: isVerified,
          id: data.data?.id,
          to: data.data?.to || to,
          status: data.data?.status,
          raw: data.data,
          message: isVerified ? "OTP verified successfully" : "Invalid or expired OTP"
        };
      }

      const errorMessage =
        data.error?.message ||
        (data.error?.fields ? Object.values(data.error.fields).flat().join(", ") : null) ||
        data.message ||
        "Invalid or expired OTP";

      return {
        success: false,
        verified: false,
        status: response.status,
        message: errorMessage,
        raw: data
      };
    } catch (err) {
      return {
        success: false,
        verified: false,
        message: `Wakit verification connection error: ${err.message}`
      };
    }
  }
}

module.exports = new WakitService();
