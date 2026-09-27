require("dotenv").config();

const env = {
  // Application
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000", 10),

  // Supabase PostgreSQL Database Connection
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "",
  DATABASE_URL: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || "",
  SUPABASE_DB_HOST: process.env.SUPABASE_DB_HOST || process.env.DB_HOST || "localhost",
  SUPABASE_DB_PORT: parseInt(process.env.SUPABASE_DB_PORT || process.env.DB_PORT || "5432", 10),
  SUPABASE_DB_USER: process.env.SUPABASE_DB_USER || process.env.DB_USER || "postgres",
  SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || "",
  SUPABASE_DB_NAME: process.env.SUPABASE_DB_NAME || process.env.DB_NAME || "postgres",
  DB_HOST: process.env.SUPABASE_DB_HOST || process.env.DB_HOST || "localhost",
  DB_PORT: parseInt(process.env.SUPABASE_DB_PORT || process.env.DB_PORT || "5432", 10),
  DB_USER: process.env.SUPABASE_DB_USER || process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || "",
  DB_NAME: process.env.SUPABASE_DB_NAME || process.env.DB_NAME || "postgres",
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),

  // Authorization Secret
  JWT_SECRET: process.env.JWT_SECRET || "koli_saptapadi_express_jwt_secret_key_2026",

  // Cloudflare R2 Object Storage
  CLOUDFLARE_R2_IS_LIVE: parseInt(process.env.CLOUDFLARE_R2_IS_LIVE || "1", 10),
  CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || "",
  CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || "koli",
  CLOUDFLARE_R2_PUBLIC_URL: (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").replace(/\/+$/, ""),

  // Security & Document Verification
  VERIFICATION_STRICT_MODE: parseInt(process.env.VERIFICATION_STRICT_MODE || "1", 10),
  FACE_SIMILARITY_THRESHOLD: parseInt(process.env.FACE_SIMILARITY_THRESHOLD || "70", 10),

  // Razorpay Configuration
  RAZORPAY_IS_LIVE: parseInt(process.env.RAZORPAY_IS_LIVE || "1", 10),
  RAZORPAY_LIVE_KEY_ID: process.env.RAZORPAY_LIVE_KEY_ID || "",
  RAZORPAY_LIVE_KEY_SECRET: process.env.RAZORPAY_LIVE_KEY_SECRET || "",
  RAZORPAY_TEST_KEY_ID: process.env.RAZORPAY_TEST_KEY_ID || "",
  RAZORPAY_TEST_KEY_SECRET: process.env.RAZORPAY_TEST_KEY_SECRET || "",

  // Dynamic getters for Razorpay based on RAZORPAY_IS_LIVE
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

  // AiSensy WhatsApp Configuration
  AISENSY_API_KEY: process.env.AISENSY_API_KEY || process.env.AISENSY_PROJECT_API_PWD || "",
  AISENSY_PROJECT_API_PWD: process.env.AISENSY_PROJECT_API_PWD || process.env.AISENSY_API_KEY || "",
  AISENSY_OTP_TEMPLATE: process.env.AISENSY_OTP_TEMPLATE || process.env.AISENSY_CAMPAIGN_NAME || "OTP",
  AISENSY_CAMPAIGN_NAME: process.env.AISENSY_CAMPAIGN_NAME || process.env.AISENSY_OTP_TEMPLATE || "OTP",
  AISENSY_BASE_URL: process.env.AISENSY_BASE_URL || "https://backend.aisensy.com/campaign/t1/api/v2",

  // Master OTP
  MASTER_OTP: process.env.MASTER_OTP || "",

  // Timezone
  TIMEZONE: process.env.TIMEZONE || "Asia/Kolkata"
};

module.exports = env;
