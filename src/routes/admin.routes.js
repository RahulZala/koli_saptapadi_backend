const express = require("express");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

function getAdminPhones() {
  const raw = env.ADMIN_PHONES || "919760975757,917405603337,9760975757,7405603337,9638336198,919638336198";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\D/g, ""))
    .filter(Boolean);
}

function isAuthorizedPhone(phone) {
  const digits = String(phone || "").trim().replace(/\D/g, "");
  if (!digits) return false;
  const adminList = getAdminPhones();
  const phone10 = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const phone12 = digits.length === 10 ? `91${digits}` : digits;
  return adminList.some((p) => p === digits || p === phone10 || p === phone12);
}

// Middleware to authenticate admin requests
const authenticateAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"] || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Missing admin token" });
    }

    const payload = jwt.verify(token, env.ADMIN_JWT_SECRET);
    if (payload.role !== "admin" || !isAuthorizedPhone(payload.phone)) {
      return res.status(401).json({ error: "Unauthorized: Invalid admin credentials" });
    }

    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized or session expired" });
  }
};

// Admin Public Auth Routes
router.post("/auth/send-otp", adminController.sendOtp);
router.post("/auth/verify-otp", adminController.verifyOtp);

// Admin Protected Routes
router.get("/stats", authenticateAdmin, adminController.getStats);
router.get("/users", authenticateAdmin, adminController.getUsers);
router.get("/users/:id", authenticateAdmin, adminController.getUserDetails);
router.patch("/users/:id/status", authenticateAdmin, adminController.updateUserStatus);
router.patch("/users/:id/kyc", authenticateAdmin, adminController.updateUserKyc);
router.get("/plans", authenticateAdmin, adminController.getPlans);
router.patch("/plans/:id", authenticateAdmin, adminController.updatePlan);
router.get("/reports", authenticateAdmin, adminController.getReports);
router.post("/notifications/send", authenticateAdmin, adminController.sendNotification);

module.exports = router;
