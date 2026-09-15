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

const app = express();

// Basic Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Route Normalization Alias Middleware for legacy Android endpoint requests
app.use(routeAlias);

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
  notificationRoutes
];

apiRoutes.forEach(router => {
  app.use("/api", router);
});

// Root & API Healthcheck Endpoints (supports GET and POST)
app.all(["/health", "/api/health", "/api/calls/health", "/"], async (req, res) => {
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
