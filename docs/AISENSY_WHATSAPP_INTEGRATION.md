# AiSensy WhatsApp Integration & Template Management Guide

This document outlines the AiSensy WhatsApp OTP and notification architecture in the Koli Saptapadi Express API.

---

## 📌 Overview

- **Provider**: AiSensy Campaign API (`https://backend.aisensy.com/campaign/t1/api/v2`)
- **Active Auth OTP Template**: `new_auth`
- **Region Restriction**: **India only (+91)**. Numbers outside India or invalid numbers are automatically blocked.
- **Previous Gateway**: Legacy Wakit gateway code has been commented out and deprecated.

---

## ⚙️ Environment Variables (.env)

Configure your AiSensy credentials and template names in `.env`:

```env
# ==========================================
# AiSensy WhatsApp OTP Configuration
# ==========================================
# Your AiSensy API Key & Project API Password
AISENSY_API_KEY=228164f17ff364eff1c10
AISENSY_PROJECT_API_PWD=228164f17ff364eff1c10

# Default Approved Template Name for OTP verification
AISENSY_OTP_TEMPLATE=new_auth
AISENSY_CAMPAIGN_NAME=new_auth

# AiSensy Campaign v2 API URL
AISENSY_BASE_URL=https://backend.aisensy.com/campaign/t1/api/v2
```

---

## 🇮🇳 Phone Number Validation Rules (India +91 Only)

All numbers are strictly validated before making any API call to AiSensy:

1. **Accepted formats**:
   - `9876543210` (10 digits)
   - `+919876543210` (+91 with 10 digits)
   - `919876543210` (91 with 10 digits)
   - `09876543210` (0 with 10 digits)
2. **Normalized format sent to AiSensy**:
   - `+91XXXXXXXXXX` (E.164 standard)
3. **Prefix validation**:
   - Must start with valid Indian mobile operator prefixes (`6`, `7`, `8`, or `9`).
4. **Non-Indian numbers**:
   - Any number with other country codes (e.g. `+1...`, `+44...`, `+971...`) is rejected with:
     `"Only valid 10-digit Indian mobile numbers (+91) are supported"`.

---

## 💬 How `new_auth` Template Works in AiSensy

AiSensy requires the template to be approved in your Meta WhatsApp Manager and created as an API Campaign in AiSensy.

When `/api/calls/send_otp` is called:
1. Backend generates a 6-digit random OTP and stores it with a 5-minute expiry in PostgreSQL (`user_otps`).
2. Sends the following POST request payload to AiSensy:
```json
{
  "apiKey": "228164f17ff364eff1c10",
  "campaignName": "new_auth",
  "destination": "+919876543210",
  "userName": "User",
  "templateParams": ["123456"],
  "source": "api"
}
```
3. Header:
```http
X-AiSensy-Project-API-Pwd: 228164f17ff364eff1c10
Content-Type: application/json
```

---

## 🚀 How to Manage Future / Next Template Names

You can manage next templates in two ways:

### 1. Changing the Default OTP Template Name (Zero Code Changes)
If you approve a new template name for OTP in AiSensy (e.g. `koli_otp_v2`), simply update your `.env`:
```env
AISENSY_OTP_TEMPLATE=koli_otp_v2
```

### 2. Sending Other Templates (Welcome, KYC, Match Alerts, etc.)
Use the generic `sendTemplateMessage` method in [`src/services/aisensy.service.js`](../src/services/aisensy.service.js):

```javascript
const aisensyService = require("../services/aisensy.service");

// Example A: Send custom OTP template
await aisensyService.sendOTP("9876543210", "123456", "Rahul", "new_auth");

// Example B: Send Welcome template with parameters
await aisensyService.sendTemplateMessage(
  "9876543210", 
  "welcome_user", 
  ["Rahul", "KP10045"], 
  { userName: "Rahul" }
);

// Example C: Send Match Alert template
await aisensyService.sendTemplateMessage(
  "9876543210", 
  "match_notification", 
  ["Pooja", "https://koliapp.com/p/123"],
  { userName: "Rahul" }
);
```

---

## 🧪 Testing the API

### Send OTP:
```bash
curl -X POST http://localhost:3000/api/calls/send_otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

### Verify OTP:
```bash
curl -X POST http://localhost:3000/api/calls/verify_otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456"}'
```
