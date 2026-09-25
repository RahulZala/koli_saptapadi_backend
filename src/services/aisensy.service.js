const env = require("../config/env");

class AiSensyService {
  get baseUrl() {
    return (env.AISENSY_BASE_URL || "https://backend.aisensy.com/campaign/t1/api/v2").replace(/\/+$/, "");
  }

  get apiKey() {
    return env.AISENSY_API_KEY || env.AISENSY_PROJECT_API_PWD || "";
  }

  /**
   * Default template names configured via environment variables
   */
  get templates() {
    return {
      AUTH_OTP: "new_auth",
      WELCOME: "welcome_user",
      MATCH_ALERT: "match_notification",
    };
  }

  /**
   * Validates and formats phone number strictly for Indian mobile numbers (+91)
   * Rejects numbers outside India.
   * @param {string} phone
   * @returns {{ valid: boolean, destination: string, nationalNumber?: string, message?: string }}
   */
  validateAndFormatIndianNumber(phone) {
    if (!phone) {
      return { valid: false, destination: "", message: "Phone number is required" };
    }

    let digits = String(phone).trim().replace(/\D/g, "");

    // If starts with 91 (country code) and has 12 digits
    if (digits.startsWith("91") && digits.length === 12) {
      digits = digits.substring(2);
    } else if (digits.startsWith("0") && digits.length === 11) {
      digits = digits.substring(1);
    }

    // Must be exactly 10 digits and start with 6, 7, 8, or 9 (Indian mobile operator prefix)
    if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
      return {
        valid: false,
        destination: "",
        message: "Only valid 10-digit Indian mobile numbers (+91) are supported"
      };
    }

    return {
      valid: true,
      destination: `+91${digits}`,
      nationalNumber: digits
    };
  }

  /**
   * Legacy formatting helper
   */
  formatDestination(phone) {
    const check = this.validateAndFormatIndianNumber(phone);
    return check.valid ? check.destination : "";
  }

  /**
   * Check if AiSensy service is configured with an API key
   */
  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim() !== "");
  }

  /**
   * Generic method to send ANY template message via AiSensy
   * @param {string} phone - Recipient phone number (India +91 only)
   * @param {string} templateName - Exact template / campaign name in AiSensy (e.g. 'new_auth', 'welcome_user', etc.)
   * @param {Array<string|number>} [templateParams=[]] - Array of template placeholder values matching {{1}}, {{2}}, etc.
   * @param {Object} [options={}] - Optional metadata (userName, media, tags, attributes)
   * @returns {Promise<{success: boolean, message: string, data?: any, raw?: any}>}
   */
  async sendTemplateMessage(phone, templateName, templateParams = [], options = {}) {
    const validation = this.validateAndFormatIndianNumber(phone);
    if (!validation.valid) {
      return { success: false, message: validation.message || "Invalid Indian mobile number" };
    }

    if (!templateName || typeof templateName !== "string") {
      return { success: false, message: "Valid template / campaign name is required" };
    }

    if (!this.isConfigured()) {
      return { success: false, message: "AiSensy API key / password is not configured" };
    }

    const destination = validation.destination;
    const endpoint = this.baseUrl;

    const payload = {
      apiKey: this.apiKey.trim(),
      campaignName: templateName.trim(),
      destination: destination,
      userName: options.userName || "User",
      templateParams: (templateParams || []).map(p => String(p)),
      source: options.source || "api"
    };

    if (options.media && typeof options.media === "object") {
      payload.media = options.media;
    }
    if (options.attributes && typeof options.attributes === "object") {
      payload.attributes = options.attributes;
    }
    if (Array.isArray(options.tags) && options.tags.length > 0) {
      payload.tags = options.tags;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-AiSensy-Project-API-Pwd": this.apiKey.trim()
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData = {};
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { rawResponse: responseText };
      }

      if (
        response.ok &&
        (responseData.status === "success" ||
          responseData.success === true ||
          responseData.submitted === true ||
          responseData.data?.submitted === true)
      ) {
        return {
          success: true,
          template: templateName,
          message: `WhatsApp template '${templateName}' sent successfully`,
          data: responseData,
          raw: responseData
        };
      }

      const errorMessage =
        responseData.message ||
        responseData.error ||
        responseData.msg ||
        (responseData.errors ? JSON.stringify(responseData.errors) : null) ||
        `AiSensy request failed with HTTP ${response.status}`;

      console.error("[AiSensy] Send template message failed:", {
        status: response.status,
        templateName,
        destination,
        response: responseData
      });

      return {
        success: false,
        template: templateName,
        status: response.status,
        message: errorMessage,
        raw: responseData
      };
    } catch (err) {
      console.error("[AiSensy] Request connection error:", err);
      return {
        success: false,
        template: templateName,
        message: `AiSensy connection error: ${err.message}`
      };
    }
  }

  /**
   * Helper specifically for sending OTP using the AUTH_OTP template (default: 'new_auth')
   * @param {string} phone - Recipient phone number (India +91 only)
   * @param {string|number} otp - 6-digit OTP code
   * @param {string} [userName="User"] - Optional recipient name
   * @param {string} [overrideTemplateName] - Optional custom template name override
   * @returns {Promise<{success: boolean, message: string, data?: any, raw?: any}>}
   */
  async sendOTP(phone, otp, userName = "User", overrideTemplateName = null) {
    if (!otp) {
      return { success: false, message: "OTP code is required" };
    }

    const template = overrideTemplateName || this.templates.AUTH_OTP;
    return this.sendTemplateMessage(phone, template, [otp], { userName });
  }
}

module.exports = new AiSensyService();
