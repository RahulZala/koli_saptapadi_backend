const express = require("express");
const cors = require("cors");
const routeAlias = require("./middleware/routeAlias");
const errorHandler = require("./middleware/errorHandler");

// Import Route Modules
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const profileRoutes = require("./routes/profile.routes");
const interestRoutes = require("./routes/interest.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const locationRoutes = require("./routes/location.routes");
const documentRoutes = require("./routes/document.routes");
const imageRoutes = require("./routes/image.routes");
const notificationRoutes = require("./routes/notification.routes");
const shortlistRoutes = require("./routes/shortlist.routes");
const privacyRoutes = require("./routes/privacy.routes");
const biodataRoutes = require("./routes/biodata.routes");
const profileViewsRoutes = require("./routes/profile-views.routes");
const chatRoutes = require("./routes/chat.routes");
const kundliRoutes = require("./routes/kundli.routes");
const referralRoutes = require("./routes/referral.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

// Basic Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Route Normalization Alias Middleware for legacy Android endpoint requests
app.use(routeAlias);

// Mount Admin API Endpoints
app.use("/api/admin", adminRoutes);

// Mount API Route Handlers (supporting both /api/calls and /api)
const apiRoutes = [
  authRoutes,
  userRoutes,
  profileRoutes,
  interestRoutes,
  subscriptionRoutes,
  locationRoutes,
  documentRoutes,
  imageRoutes,
  notificationRoutes,
  shortlistRoutes,
  privacyRoutes,
  biodataRoutes,
  profileViewsRoutes,
  chatRoutes,
  kundliRoutes,
  referralRoutes
];

apiRoutes.forEach(router => {
  app.use("/api", router);
});

// Root Endpoint - Serve HTML Status Page with Vercel Analytics
app.get("/", async (req, res) => {
  let dbStatus = "connected";
  let dbError = null;

  try {
    const pool = require("./config/database");
    await pool.query("SELECT 1");
  } catch (err) {
    dbStatus = "disconnected";
    dbError = err.message;
  }

  const statusColor = dbStatus === "connected" ? "#10b981" : "#ef4444";
  const timestamp = new Date().toISOString();

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Koli Saptapadi API Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    h1 {
      color: #1f2937;
      font-size: 32px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #6b7280;
      font-size: 16px;
      margin-bottom: 32px;
    }
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .status-label {
      color: #374151;
      font-weight: 500;
      font-size: 14px;
    }
    .status-value {
      font-weight: 600;
      font-size: 14px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-success {
      background: #d1fae5;
      color: #065f46;
    }
    .badge-error {
      background: #fee2e2;
      color: #991b1b;
    }
    .info-text {
      color: #6b7280;
      font-size: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .analytics-note {
      margin-top: 16px;
      padding: 12px;
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
      font-size: 13px;
      color: #1e40af;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎉 API is Running</h1>
    <p class="subtitle">Koli Saptapadi Express REST API</p>
    
    <div class="status-row">
      <span class="status-label">Status</span>
      <span class="badge badge-success">ONLINE</span>
    </div>
    
    <div class="status-row">
      <span class="status-label">Database</span>
      <span class="badge ${dbStatus === 'connected' ? 'badge-success' : 'badge-error'}">${dbStatus.toUpperCase()}</span>
    </div>
    
    <div class="status-row">
      <span class="status-label">Last Checked</span>
      <span class="status-value">${timestamp}</span>
    </div>

    <div class="analytics-note">
      ℹ️ <strong>Vercel Web Analytics Enabled:</strong> This page tracks visitor analytics via Vercel. API endpoints remain JSON-based.
    </div>
    
    <p class="info-text">
      <strong>API Base URL:</strong> /api/calls<br>
      <strong>Documentation:</strong> See README.md for endpoint details<br>
      <strong>Health Check (JSON):</strong> /health, /api/health
    </p>
  </div>
  
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`);
});

// Health Check Endpoints (JSON response)
app.all(["/health", "/api/health", "/api/calls/health"], async (req, res) => {
  let dbStatus = "connected";
  let dbError = null;

  try {
    const pool = require("./config/database");
    await pool.query("SELECT 1");
  } catch (err) {
    dbStatus = "disconnected";
    dbError = err.message;
  }

  res.status(200).json({
    status: true,
    message: "Koli Saptapadi Express API is running",
    database: dbStatus,
    ...(dbError ? { database_error: dbError } : {}),
    env_checks: {
      has_SUPABASE_DATABASE_URL: Boolean(process.env.SUPABASE_DATABASE_URL),
      has_DATABASE_URL: Boolean(process.env.DATABASE_URL),
      has_SUPABASE_DB_HOST: Boolean(process.env.SUPABASE_DB_HOST),
      NODE_ENV: process.env.NODE_ENV || "development"
    },
    timestamp: new Date().toISOString()
  });
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: `Endpoint not found: ${req.method} ${req.url}`
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
