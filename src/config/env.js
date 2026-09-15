require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000", 10),

  // Supabase PostgreSQL connection. DATABASE_URL remains supported for deployment compatibility.
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "",
  SUPABASE_DB_HOST: process.env.SUPABASE_DB_HOST || process.env.DB_HOST || "",
  SUPABASE_DB_PORT: parseInt(process.env.SUPABASE_DB_PORT || process.env.DB_PORT || "5432", 10),
  SUPABASE_DB_USER: process.env.SUPABASE_DB_USER || process.env.DB_USER || "postgres",
  SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || "",
  SUPABASE_DB_NAME: process.env.SUPABASE_DB_NAME || process.env.DB_NAME || "postgres",
  DATABASE_URL: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "",
  DB_HOST: process.env.SUPABASE_DB_HOST || process.env.DB_HOST || "",
  DB_PORT: parseInt(process.env.SUPABASE_DB_PORT || process.env.DB_PORT || "5432", 10),
  DB_USER: process.env.SUPABASE_DB_USER || process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || "",
  DB_NAME: process.env.SUPABASE_DB_NAME || process.env.DB_NAME || "postgres",
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),

  // Cloudinary Storage
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  // Razorpay Toggle (1 = Live Mode, 0 = Test Mode)
  RAZORPAY_IS_LIVE: parseInt(process.env.RAZORPAY_IS_LIVE || "1", 10),

  // Razorpay Live Credentials
  RAZORPAY_LIVE_KEY_ID: process.env.RAZORPAY_LIVE_KEY_ID || "rzp_live_TKQyGtiD6oymse",
  RAZORPAY_LIVE_KEY_SECRET: process.env.RAZORPAY_LIVE_KEY_SECRET || "rq7yFCUICsZzcDLYgOGFkKRd",

  // Razorpay Test Credentials
  RAZORPAY_TEST_KEY_ID: process.env.RAZORPAY_TEST_KEY_ID || "rzp_test_SkT5LVPkncrUqu",
  RAZORPAY_TEST_KEY_SECRET: process.env.RAZORPAY_TEST_KEY_SECRET || "0g6X1k7Z9q3v5a1u2b0",

  // Dynamic getters for Razorpay Key ID and Secret based on RAZORPAY_IS_LIVE (1 or 0)
  get RAZORPAY_KEY_ID() {
    return this.RAZORPAY_IS_LIVE === 1 ? this.RAZORPAY_LIVE_KEY_ID : this.RAZORPAY_TEST_KEY_ID;
  },
  get RAZORPAY_KEY_SECRET() {
    return this.RAZORPAY_IS_LIVE === 1 ? this.RAZORPAY_LIVE_KEY_SECRET : this.RAZORPAY_TEST_KEY_SECRET;
  },

  // Firebase Credentials
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "",
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : "",

  // Timezone default
  TIMEZONE: "Asia/Kolkata"
};

module.exports = env;
