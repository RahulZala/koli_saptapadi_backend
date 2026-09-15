# Endpoint Verification & Testing Guide

Use these cURL commands to verify that the Express endpoints match original PHP contracts.

---

## 1. Authentication Endpoints

### Send OTP
```bash
curl -X POST http://localhost:3000/api/calls/send_otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:3000/api/calls/verify_otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456"}'
```

---

## 2. Profile Endpoints

### Get Complete Profile
```bash
curl -X POST http://localhost:3000/api/calls/my_profile \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

### Manage Basic Details
```bash
curl -X POST http://localhost:3000/api/calls/manage_basic_details \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Ramesh",
    "last_name": "Thakor",
    "gender": "male",
    "dob": "1995-05-15",
    "profile_for": "Self",
    "email": "ramesh@example.com",
    "sub_caste": "Koli"
  }'
```

---

## 3. Location & Master Data

### Get States
```bash
curl -X POST http://localhost:3000/api/calls/get_states
```

### Get Districts
```bash
curl -X POST http://localhost:3000/api/calls/get_districts \
  -H "Content-Type: application/json" \
  -d '{"state_id": 1}'
```

---

## 4. Legacy Route Aliasing Test

Test calling the legacy `.php` filename:
```bash
curl -X POST http://localhost:3000/api/calls/send_otp.php \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```
