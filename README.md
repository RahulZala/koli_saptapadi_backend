# Koli Saptapadi Express.js REST API Backend

> **Complete PHP + MySQL → Express.js Node.js REST API Backend Migration**

This repository contains the production-ready Node.js + Express.js backend migrated from the legacy PHP backend (`api/` and `koli_all.sql`).

---

## 📌 IMPORTANT PROJECT NOTES & HANDOVER SUMMARY

> [!IMPORTANT]
> **Android Backward Compatibility**: 
> The Android application interacts with endpoints ending in `.php` or prefixed with `/calls/`. The Express app incorporates an automated `routeAlias` middleware (`src/middleware/routeAlias.js`) that normalizes `/api/calls/<endpoint>.php`, `/calls/<endpoint>`, and standard routes automatically. **No code rewrites required on Android!**

> [!IMPORTANT]
> **Cloudinary Image & Document Architecture**:
> Local server file storage has been completely migrated to Cloudinary SDK (`src/services/cloudinary.service.js`). Photos uploaded via `manage_image` (up to 5 max) and identity verification documents via `upload_document` are stored securely on Cloudinary, saving secure image URLs directly in MySQL (`user_photos` and `user_document`).

> [!IMPORTANT]
> **Password Verification & Hash Compatibility**:
> User password hashes stored in MySQL use PHP's `password_hash()` bcrypt format (`$2y$`). The migration utilizes `bcryptjs` with prefix normalization (`$2y$` -> `$2a$`), enabling existing user login without forcing password resets.

> [!IMPORTANT]
> **Vercel Serverless Ready**:
> The project exposes a serverless entry point at `api/index.js` configured via `vercel.json` for effortless deployment to Vercel without requiring a persistent VPS process.

---

## 🛠️ Architecture & Folder Structure

```text
koli-express-api/
├── src/
│   ├── app.js                          # Express application initialization & middleware
│   ├── server.js                       # Local dev server entry point
│   ├── config/
│   │   ├── env.js                      # Environment configuration & defaults
│   │   ├── database.js                 # mysql2/promise connection pool
│   │   └── cloudinary.js               # Cloudinary v2 SDK setup
│   ├── middleware/
│   │   ├── auth.js                     # Authorization: Bearer <api_token> middleware
│   │   ├── routeAlias.js               # Legacy PHP endpoint alias normalizer
│   │   ├── errorHandler.js             # Global central error handler
│   │   └── upload.js                   # Multer memory storage middleware
│   ├── routes/                         # Express REST API routes
│   │   ├── auth.routes.js              # login, send_otp, verify_otp, logout, delete
│   │   ├── user.routes.js              # dashboard, report_user
│   │   ├── profile.routes.js           # basic, family, physical, address, partner details
│   │   ├── interest.routes.js          # send_intrest, manage_interest, reject_intrest
│   │   ├── subscription.routes.js      # get_plan, create_order, subscribe_plan, history
│   │   ├── location.routes.js          # get_states, get_districts, get_cities, get_sub_castes
│   │   ├── document.routes.js          # upload_document
│   │   ├── image.routes.js             # manage_image, get_image
│   │   └── notification.routes.js      # notification_list
│   ├── controllers/                    # Route request handlers
│   ├── services/                       # Core business logic layer
│   ├── repositories/                   # MySQL parameterized database queries
│   └── utils/                          # Date, height (feet/inches -> CM), validation & response helpers
├── api/
│   └── index.js                        # Vercel serverless export
├── docs/
│   ├── API_MIGRATION_MAP.md            # Mapping 34 PHP files to Express routes
│   ├── DEPLOYMENT.md                   # Full local & Vercel deployment guide
│   └── TESTING.md                      # cURL test commands for endpoints
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your database and third-party credentials in `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=koli

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 3. Start Local Server
```bash
npm run dev
```
The server will start at `http://localhost:3000`.

### 4. Test Locally with Postman

Use this base URL in Postman:

```text
http://localhost:3000/api/calls
```

Example public request:

```http
GET http://localhost:3000/api/calls/get_states
```

Example login request:

```http
POST http://localhost:3000/api/calls/login
Content-Type: application/json
```

In Postman, select **Body > raw > JSON** and provide the request body required by the endpoint. Authenticated endpoints require the token returned by login or OTP verification:

```text
Authorization: Bearer <api_token>
```

Legacy `.php` URLs are also supported, for example:

```text
http://localhost:3000/api/calls/get_states.php
```

Stop the server with `Ctrl+C`. For endpoint-specific request bodies, see [`docs/TESTING.md`](docs/TESTING.md).

---

## 📱 Android App Base URL Update

To switch your Android app from PHP to Express, update your API Base URL constant:

- **Old PHP Base URL**: `http://your-domain.com/api/calls/`
- **New Express Base URL**: `http://your-domain.com/api/calls/` (or your Vercel deployment URL `https://your-app.vercel.app/api/calls/`)

---

## 📋 Comprehensive Endpoint List

| Endpoint Path | Method | Auth Required | Description |
|---|---|---|---|
| `/api/calls/login` | `POST` | No | Login using email & password |
| `/api/calls/send_otp` | `POST` | No | Generate & send 6-digit OTP |
| `/api/calls/verify_otp` | `POST` | No | Verify OTP & return user token |
| `/api/calls/logout_user` | `POST` | Yes | Invalidate user token |
| `/api/calls/delete_user` | `POST` | Yes | Soft-delete user account |
| `/api/calls/my_profile` | `POST` | Yes | Return user profile & subscription permissions |
| `/api/calls/get_profile_data` | `POST` | Yes | Fetch details for a specific section table |
| `/api/calls/manage_basic_details` | `POST` | Yes | Save basic profile details |
| `/api/calls/manage_family_details` | `POST` | Yes | Save family details |
| `/api/calls/manage_physical_details` | `POST` | Yes | Save physical details |
| `/api/calls/manage_address` | `POST` | Yes | Save current/permanent address |
| `/api/calls/manage_marital_professional_details` | `POST` | Yes | Save marital & job details |
| `/api/calls/manage_partner_preference` | `POST` | Yes | Save partner preference filter |
| `/api/calls/view_profile` | `POST` | Yes | View accepted partner profile |
| `/api/calls/dashboard` | `POST` | Yes | Recommendation feed with age/height/city filters |
| `/api/calls/report_user` | `POST` | Yes | Report inappropriate user account |
| `/api/calls/manage_image` | `POST` | Yes | Upload/delete profile photos via Cloudinary |
| `/api/calls/get_image` | `POST` | Yes | Get list of user photos |
| `/api/calls/upload_document` | `POST` | Yes | Upload verification documents to Cloudinary |
| `/api/calls/send_intrest` | `POST` | Yes | Express interest in a profile |
| `/api/calls/manage_interest` | `POST` | Yes | Accept or reject received interest |
| `/api/calls/reject_intrest` | `POST` | Yes | Reject an interest |
| `/api/calls/interest_profile` | `POST` | Yes | Get sent/received interest lists |
| `/api/calls/notification_list` | `POST` | Yes | Get paginated notification list |
| `/api/calls/get_plan` | `POST` | Yes | Get list of subscription plans |
| `/api/calls/create_order` | `POST` | Yes | Create Razorpay order |
| `/api/calls/subscribe_plan` | `POST` | Yes | Activate/extend subscription after payment |
| `/api/calls/subscribe_history` | `POST` | Yes | Payment history |
| `/api/calls/cancel_order` | `POST` | Yes | Cancel pending payment order |
| `/api/calls/get_states` | `GET/POST` | No | Get states list |
| `/api/calls/get_districts` | `GET/POST` | No | Get districts by state_id |
| `/api/calls/get_cities` | `GET/POST` | No | Get cities by district_id |
| `/api/calls/get_sub_castes` | `GET/POST` | No | Get active sub-castes |
