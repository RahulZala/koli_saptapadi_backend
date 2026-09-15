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

// Mount API Route Handlers
app.use("/api/calls", authRoutes);
app.use("/api/calls", userRoutes);
app.use("/api/calls", profileRoutes);
app.use("/api/calls", interestRoutes);
app.use("/api/calls", subscriptionRoutes);
app.use("/api/calls", locationRoutes);
app.use("/api/calls", documentRoutes);
app.use("/api/calls", imageRoutes);
app.use("/api/calls", notificationRoutes);

// Root Healthcheck Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
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
