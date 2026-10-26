const env = require("../config/env");

/**
 * WhatsApp Cloud API Service via Picdik Marketing Meta Gateway
 * Official WhatsApp Business API Integration
 * All credentials are read exclusively from environment variables (.env).
 */
class WhatsAppService {
  get baseUrl() {
    return (env.META_WHATSAPP_BASE_URL || "").replace(/\/+$/, "");
  }

  get apiVersion() {
    return (env.META_WHATSAPP_API_VERSION || "v19.0").trim();
  }

  get phoneNumberId() {
    return (env.META_WHATSAPP_PHONE_ID || "").trim();
  }

  get wabaId() {
    return (env.META_WHATSAPP_WABA_ID || "").trim();
  }

  get businessId() {
    return (env.META_WHATSAPP_BUSINESS_ID || "").trim();
  }

  get accessToken() {
    return (env.META_WHATSAPP_ACCESS_TOKEN || "").trim();
  }

  get languageCode() {
    return (env.META_WHATSAPP_LANGUAGE_CODE || "en").trim();
  }

  /**
   * Endpoint format: API_URL/API_VERSION/PHONE_NUMBER_ID/messages
   */
  get messagesEndpoint() {
    return `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
   * Format phone number for WhatsApp recipient:
   * Requires country code prefix without '+' or special symbols (e.g. 919876543210)
   * @param {string} phone
   * @returns {string}
   */
  formatReceiver(phone) {
    if (!phone) return "";
    let digits = String(phone).trim().replace(/\D/g, "");

    // 10-digit Indian mobile number -> prepend 91
    if (digits.length === 10) {
      return `91${digits}`;
    }

    // 11-digit starting with 0 -> replace 0 with 91
    if (digits.length === 11 && digits.startsWith("0")) {
      return `91${digits.substring(1)}`;
    }

    // 12-digit starting with 91 -> return as is
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits;
    }

    return digits;
  }

  /**
   * Dynamically build template payload for ANY template name and dynamic parameters.
   *
   * @param {string} receiver - Recipient phone number
   * @param {string} templateName - Template name passed as parameter (e.g. 'auth', 'welcome', 'order_status')
   * @param {Array<string|number>|object} [params=[]] - Dynamic parameter values:
   *   - If Array: e.g. ["123456"] or ["Rahul", "Order #123"] -> placed into body parameters
   *   - If Object: { body: [...], button: [...], header: [...] }
   * @param {object} [options={}] - Additional options:
   *   - langCode (default: 'en')
   *   - buttonText / buttons (for url / copy buttons)
   *   - header (for media or header text)
   *   - components (custom full components array override)
   * @returns {object}
   */
  buildTemplatePayload(receiver, templateName, params = [], options = {}) {
    const formattedReceiver = this.formatReceiver(receiver);
    const langCode = options.langCode || options.languageCode || this.languageCode;
    const name = String(templateName || "auth").trim();

    let components = [];

    // 1. Direct full components override
    if (Array.isArray(options.components) && options.components.length > 0) {
      components = options.components;
    }
    // 2. Auth template structure with body + url button parameters
    else if (name.toLowerCase() === "auth") {
      const otpText = Array.isArray(params) && params.length > 0
        ? String(params[0]).trim()
        : (typeof params === "string" || typeof params === "number" ? String(params).trim() : "");

      components = [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otpText
            }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: otpText
            }
          ]
        }
      ];
    }
    // 3. General dynamic template structure
    else {
      let bodyParams = [];
      let buttonParams = null;
      let headerParam = null;

      if (Array.isArray(params)) {
        bodyParams = params;
      } else if (typeof params === "object" && params !== null) {
        bodyParams = Array.isArray(params.body) ? params.body : [];
        buttonParams = params.button || params.buttons;
        headerParam = params.header;
      } else if (params !== undefined && params !== null && params !== "") {
        bodyParams = [params];
      }

      // Add Header component if specified
      if (headerParam || options.header) {
        const h = headerParam || options.header;
        if (typeof h === "string") {
          components.push({
            type: "header",
            parameters: [{ type: "text", text: h }]
          });
        } else if (h.type === "image" && h.url) {
          components.push({
            type: "header",
            parameters: [{ type: "image", image: { link: h.url } }]
          });
        }
      }

      // Add Body component with dynamic parameters
      if (bodyParams.length > 0) {
        components.push({
          type: "body",
          parameters: bodyParams.map((p) => ({
            type: "text",
            text: String(p)
          }))
        });
      }

      // Add Button component if specified
      const btns = buttonParams || options.buttons || (options.buttonText ? [{ text: options.buttonText }] : null);
      if (Array.isArray(btns)) {
        btns.forEach((btn, idx) => {
          components.push({
            type: "button",
            sub_type: btn.sub_type || "url",
            index: typeof btn.index === "number" ? btn.index : idx,
            parameters: btn.parameters || [
              {
                type: "text",
                text: String(btn.text || "")
              }
            ]
          });
        });
      }
    }

    return {
      to: formattedReceiver,
      recipient_type: "individual",
      type: "template",
      template: {
        language: {
          policy: "deterministic",
          code: langCode
        },
        name: name,
        components: components
      }
    };
  }

  /**
   * Dynamically build the authentication OTP template payload
   * @param {string} receiver
   * @param {string|number} otp
   * @param {string} [templateName="auth"]
   * @param {string} [langCode="en"]
   * @returns {object}
   */
  buildAuthTemplatePayload(receiver, otp, templateName = "auth", langCode = "en") {
    return this.buildTemplatePayload(receiver, templateName, [otp], { langCode });
  }

  /**
   * Send WhatsApp Authentication OTP using dynamic template name and OTP parameter
   * @param {string} phone - Recipient phone number
   * @param {string|number} otp - OTP code
   * @param {string} [templateName="auth"] - Template name passed directly as a parameter
   * @param {string} [langCode="en"] - Language code passed as a parameter
   * @returns {Promise<{success: boolean, message: string, data?: any, raw?: any}>}
   */
  async sendAuthOTP(phone, otp, templateName = "auth", langCode = "en") {
    if (!phone) {
      return { success: false, message: "Recipient phone number is required" };
    }
    if (!otp) {
      return { success: false, message: "OTP code is required" };
    }

    const payload = this.buildAuthTemplatePayload(phone, otp, templateName, langCode);
    return this.sendRawMessage(payload);
  }

  /**
   * Generic dynamic template sender:
   * Pass ANY template name and dynamic parameter values without relying on .env
   *
   * @example
   * await whatsappService.sendTemplate("9876543210", "auth", ["123456"]);
   * await whatsappService.sendTemplate("9876543210", "welcome", ["Rahul"]);
   *
   * @param {string} phone - Recipient phone number
   * @param {string} templateName - Template name passed as a parameter
   * @param {Array<string|number>|object} [params=[]] - Dynamic parameter values
   * @param {object} [options={}] - Optional settings (langCode, buttons, header)
   * @returns {Promise<{success: boolean, message: string, data?: any, raw?: any}>}
   */
  async sendTemplate(phone, templateName, params = [], options = {}) {
    if (!phone) {
      return { success: false, message: "Recipient phone number is required" };
    }
    if (!templateName) {
      return { success: false, message: "Template name parameter is required" };
    }

    const payload = this.buildTemplatePayload(phone, templateName, params, options);
    return this.sendRawMessage(payload);
  }

  // Alias for backward compatibility
  async sendOTP(phone, otp, templateName = "auth", langCode = "en") {
    return this.sendAuthOTP(phone, otp, templateName, langCode);
  }

  /**
   * Send raw template or direct message payload to Meta WhatsApp messages endpoint
   * @param {object} payload
   * @returns {Promise<{success: boolean, message: string, data?: any, raw?: any}>}
   */
  async sendRawMessage(payload) {
    const endpoint = this.messagesEndpoint;
    const token = this.accessToken;

    if (!token) {
      return {
        success: false,
        message: "WhatsApp Access Token is not configured in .env"
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData = {};
      try {
        responseData = JSON.parse(responseText);
      } catch (err) {
        responseData = { rawResponse: responseText };
      }

      const isOk =
        response.ok &&
        (responseData.success === true ||
          responseData.queue_id ||
          responseData.queueId ||
          responseData.messages ||
          responseData.status === "success" ||
          responseData.submitted === true);

      if (isOk) {
        return {
          success: true,
          message: "WhatsApp message sent successfully",
          data: responseData,
          raw: responseData
        };
      }

      const errorMsg =
        responseData.error ||
        responseData.message ||
        responseData.msg ||
        (responseData.errors ? JSON.stringify(responseData.errors) : `HTTP ${response.status}`);

      return {
        success: false,
        status: response.status,
        message: errorMsg,
        data: responseData,
        raw: responseData
      };
    } catch (err) {
      return {
        success: false,
        message: `WhatsApp API connection error: ${err.message}`
      };
    }
  }
}

module.exports = new WhatsAppService();
