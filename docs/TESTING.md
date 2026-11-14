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

### Admin master-data management

The admin token is returned by `/api/admin/auth/verify-otp`. Use it for these protected endpoints:

```text
GET    /api/admin/master-data
POST   /api/admin/master-data/states
POST   /api/admin/master-data/districts
POST   /api/admin/master-data/cities
POST   /api/admin/master-data/sub_castes
PATCH  /api/admin/master-data/{states|districts|cities|sub_castes}/:id
DELETE /api/admin/master-data/{states|districts|cities|sub_castes}/:id
Authorization: Bearer <admin-token>
```

Districts require `state_id`; cities require `district_id`; all creates and edits require `name`. Sub-caste `PATCH` also accepts `is_active: true|false`. Deleting a sub-caste disables it so existing profiles remain valid. Location deletion returns `409` while child locations or user addresses still reference the record.

These endpoints use the existing `states`, `districts`, `cities`, `sub_castes`, and `user_addresses` tables; no schema migration is required.

---

## 4. Legacy Route Aliasing Test

Test calling the legacy `.php` filename:
```bash
curl -X POST http://localhost:3000/api/calls/send_otp.php \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```
