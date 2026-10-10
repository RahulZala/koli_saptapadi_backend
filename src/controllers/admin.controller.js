const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const env = require("../config/env");
const aisensyService = require("../services/aisensy.service");
const adminNotificationService = require("../services/admin-notification.service");

// Payment statuses that count as "paid"
const PAID = ["paid", "success", "captured", "completed"];
const PAID_SQL = PAID.map((s) => `'${s}'`).join(",");

// Auto-migration helper for subscription_plans description column & user_document constraints
(async () => {
  try {
    await pool.query(`
      ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS description text DEFAULT '';
      ALTER TABLE public.user_document ALTER COLUMN front_image DROP NOT NULL;
      ALTER TABLE public.user_document ALTER COLUMN back_image DROP NOT NULL;
      ALTER TABLE public.user_document ALTER COLUMN profile DROP NOT NULL;
    `);
  } catch (err) {
    // Ignore if table doesn't exist yet or column already exists
  }
})();

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
  // Check exact match, or 10-digit / 12-digit (91 prefix) equivalence
  const phone10 = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const phone12 = digits.length === 10 ? `91${digits}` : digits;

  return adminList.some((p) => p === digits || p === phone10 || p === phone12);
}

// Admin Controller
class AdminController {
  // 1. Send OTP
  async sendOtp(req, res) {
    try {
      const rawPhone = String(req.body.phone || "").trim();
      if (!rawPhone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      if (!isAuthorizedPhone(rawPhone)) {
        return res.status(403).json({ error: "Access denied. Phone number not in authorized admin list." });
      }

      // Check rate limit: max 5 requests in last 10 minutes
      const [rateRows] = await pool.execute(
        `SELECT count(*)::int AS c FROM user_otps WHERE phone=$1 AND created_at > now() - interval '10 minutes'`,
        [rawPhone]
      );
      if (rateRows[0]?.c >= 5) {
        return res.status(429).json({ error: "Too many OTP attempts. Please try again after 10 minutes." });
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await pool.execute(
        `INSERT INTO user_otps(phone, otp, expires_at) VALUES($1, $2, now() + interval '5 minutes')`,
        [rawPhone, otp]
      );

      console.log(`\n========================================`);
      console.log(`[ADMIN AUTH] Login OTP for ${rawPhone}: ${otp}`);
      console.log(`========================================\n`);

      // Try sending via WhatsApp AiSensy service
      try {
        await aisensyService.sendOTP(rawPhone, otp);
      } catch (waErr) {
        console.warn("[ADMIN AUTH] WhatsApp send error (fallback to log):", waErr.message);
      }

      return res.json({ ok: true, message: "OTP sent successfully to admin number." });
    } catch (err) {
      console.error("Admin sendOtp error:", err);
      return res.status(500).json({ error: "Failed to generate admin OTP" });
    }
  }

  // 2. Verify OTP
  async verifyOtp(req, res) {
    try {
      const rawPhone = String(req.body.phone || "").trim();
      const otp = String(req.body.otp || "").trim();

      if (!rawPhone || !otp) {
        return res.status(400).json({ error: "Phone and OTP are required" });
      }

      if (!isAuthorizedPhone(rawPhone)) {
        return res.status(403).json({ error: "Access denied. Phone number not authorized." });
      }

      const isMasterOtp = env.MASTER_OTP && String(otp).trim() === String(env.MASTER_OTP).trim();

      let valid = false;
      if (isMasterOtp) {
        valid = true;
      } else {
        const [rows] = await pool.execute(
          `UPDATE user_otps SET is_used=true WHERE id = (
             SELECT id FROM user_otps WHERE phone=$1 AND otp=$2 AND is_used=false AND expires_at > now()
             ORDER BY id DESC LIMIT 1) RETURNING id`,
          [rawPhone, otp]
        );
        if (rows && rows.length > 0) {
          valid = true;
        }
      }

      if (!valid) {
        return res.status(401).json({ error: "Invalid or expired OTP" });
      }

      const token = jwt.sign(
        { role: "admin", phone: rawPhone },
        env.ADMIN_JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({ ok: true, token });
    } catch (err) {
      console.error("Admin verifyOtp error:", err);
      return res.status(500).json({ error: "Failed to verify admin OTP" });
    }
  }

  // 3. System Stats
  async getStats(req, res) {
    try {
      const [rows] = await pool.execute(`
        SELECT
          (SELECT count(*) FROM users)::int AS total_users,
          (SELECT count(*) FROM users WHERE is_verified = true)::int AS verified_users,
          (SELECT count(*) FROM users WHERE is_active = false)::int AS disabled_users,
          (SELECT count(DISTINCT user_id) FROM subscription_payments WHERE status IN (${PAID_SQL}))::int AS paid_users,
          (SELECT coalesce(sum(amount), 0) FROM subscription_payments WHERE status IN (${PAID_SQL}))::float AS revenue,
          (SELECT count(*) FROM user_reports)::int AS reports
      `);

      const s = rows[0] || {
        total_users: 0,
        verified_users: 0,
        disabled_users: 0,
        paid_users: 0,
        revenue: 0,
        reports: 0
      };

      const totalUsers = s.total_users || 0;
      const paidUsers = s.paid_users || 0;

      return res.json({
        ...s,
        free_users: Math.max(0, totalUsers - paidUsers)
      });
    } catch (err) {
      console.error("Admin getStats error:", err);
      return res.status(500).json({ error: "Failed to fetch stats" });
    }
  }

  // 4. Users List with Search & Filtering
  async getUsers(req, res) {
    try {
      const search = (req.query.search || "").trim();
      const filter = req.query.filter || "all";
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = (page - 1) * limit;

      const paidExists = `EXISTS (SELECT 1 FROM subscription_payments p WHERE p.user_id=u.id AND p.status IN (${PAID_SQL}))`;
      const where = [`(u.id::text ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.phone ILIKE $1 OR u.email ILIKE $1)`];

      if (filter === "disabled") where.push("u.is_active=false");
      if (filter === "active") where.push("u.is_active=true");
      if (filter === "verified") where.push("u.is_verified=true");
      if (filter === "pending_kyc" || filter === "pending") where.push("u.document=true AND u.is_verified=false");
      if (filter === "unverified") where.push("u.is_verified=false");
      if (filter === "paid") where.push(paidExists);
      if (filter === "free") where.push(`NOT ${paidExists}`);

      const sql = `
        SELECT u.id, u.first_name, u.last_name, u.phone, u.email, u.gender, u.is_verified, u.is_active, u.document, u.created_at,
               ${paidExists} AS is_paid,
               (SELECT sp.name FROM user_subscriptions us JOIN subscription_plans sp ON sp.id=us.plan_id
                  WHERE us.user_id=u.id AND us.is_active=1 ORDER BY us.id DESC LIMIT 1) AS current_plan,
               count(*) OVER()::int AS total
        FROM users u
        WHERE ${where.join(" AND ")}
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [rows] = await pool.execute(sql, [`%${search}%`]);
      const total = rows[0]?.total || 0;

      return res.json({
        users: rows,
        total,
        page,
        limit
      });
    } catch (err) {
      console.error("Admin getUsers error:", err);
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  // 5. User Details by ID
  async getUserDetails(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "Invalid user ID" });

      const [userRows] = await pool.execute(
        `SELECT id, first_name, last_name, sub_caste, phone, email, gender, dob, profile_for,
                is_verified, is_active, created_at, updated_at, document
         FROM users WHERE id = $1`,
        [id]
      );

      if (!userRows.length) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const user = userRows[0];

      const one = async (sql) => {
        try {
          const [r] = await pool.execute(sql, [id]);
          return r[0] || null;
        } catch (e) {
          return null;
        }
      };

      const many = async (sql) => {
        try {
          const [r] = await pool.execute(sql, [id]);
          return r || [];
        } catch (e) {
          return [];
        }
      };

      const [
        family,
        physical,
        professional,
        partner,
        addresses,
        photos,
        documents,
        subscriptions,
        payments,
        reports
      ] = await Promise.all([
        one(`SELECT * FROM family_details WHERE user_id=$1`),
        one(`SELECT * FROM physical_details WHERE user_id=$1`),
        one(`SELECT * FROM marital_professional_details WHERE user_id=$1`),
        one(`SELECT * FROM partner_preferences WHERE user_id=$1`),
        many(`SELECT a.*, s.name AS state, d.name AS district, c.name AS city
              FROM user_addresses a
              LEFT JOIN states s ON s.id=a.state_id
              LEFT JOIN districts d ON d.id=a.district_id
              LEFT JOIN cities c ON c.id=a.city_id
              WHERE a.user_id=$1`),
        many(`SELECT id, image_url, created_at FROM user_photos WHERE user_id=$1 ORDER BY id`),
        many(`SELECT id, document_type, profile, front_image, back_image FROM user_document WHERE user_id=$1 ORDER BY id DESC`),
        many(`SELECT us.*, sp.name AS plan_name FROM user_subscriptions us LEFT JOIN subscription_plans sp ON sp.id=us.plan_id WHERE us.user_id=$1 ORDER BY us.id DESC`),
        many(`SELECT p.id, p.amount, p.status, p.payment_method, p.razorpay_order_id, p.razorpay_payment_id, p.created_at, sp.name AS plan_name
              FROM subscription_payments p LEFT JOIN subscription_plans sp ON sp.id=p.plan_id WHERE p.user_id=$1 ORDER BY p.id DESC`),
        many(`SELECT r.id, r.reason, r.created_at, u.first_name, u.last_name
              FROM user_reports r JOIN users u ON u.id=r.from_user_id WHERE r.to_user_id=$1 ORDER BY r.id DESC`)
      ]);

      return res.json({
        user,
        family,
        physical,
        professional,
        partner,
        addresses,
        photos,
        documents,
        subscriptions,
        payments,
        reports
      });
    } catch (err) {
      console.error("Admin getUserDetails error:", err);
      return res.status(500).json({ error: "Failed to fetch user details" });
    }
  }

  // 6. Toggle User Active/Disabled Status
  async updateUserStatus(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "Invalid user ID" });

      if (typeof req.body.is_active !== "boolean") {
        return res.status(400).json({ error: "is_active (boolean) is required" });
      }

      const [rows] = await pool.execute(
        `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, is_active`,
        [req.body.is_active, id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json(rows[0]);
    } catch (err) {
      console.error("Admin updateUserStatus error:", err);
      return res.status(500).json({ error: "Failed to update user status" });
    }
  }

  // 6b. Update User KYC Verification & Document Status (Approve / Unverify / Reject)
  async updateUserKyc(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "Invalid user ID" });

      const { action } = req.body; // 'verify' | 'unverify' | 'reject'

      if (action === "verify") {
        // Mark as verified & complete verification done
        const [rows] = await pool.execute(
          `UPDATE users SET is_verified = true, document = true WHERE id = $1 RETURNING id, is_verified, document`,
          [id]
        );
        if (!rows.length) return res.status(404).json({ error: "User not found" });

        return res.json({
          ok: true,
          message: "KYC approved and verified successfully. Complete verification is done.",
          user: rows[0]
        });
      }

      if (action === "unverify") {
        // Mark as unverified
        const [rows] = await pool.execute(
          `UPDATE users SET is_verified = false WHERE id = $1 RETURNING id, is_verified, document`,
          [id]
        );
        if (!rows.length) return res.status(404).json({ error: "User not found" });

        return res.json({
          ok: true,
          message: "KYC marked as unverified.",
          user: rows[0]
        });
      }

      if (action === "reject") {
        // Reject KYC: set is_verified=false, document=false and remove document records/URLs for user
        const [rows] = await pool.execute(
          `UPDATE users SET is_verified = false, document = false WHERE id = $1 RETURNING id, is_verified, document`,
          [id]
        );
        if (!rows.length) return res.status(404).json({ error: "User not found" });

        // Delete/clear document records so URLs are removed from user
        try {
          await pool.execute(
            `DELETE FROM user_document WHERE user_id = $1`,
            [id]
          );
        } catch (docErr) {
          console.warn("Notice clearing user_document:", docErr.message);
        }

        return res.json({
          ok: true,
          message: "KYC rejected. Document status set to false and document URLs removed from user.",
          user: rows[0]
        });
      }

      return res.status(400).json({ error: "Invalid action. Expected 'verify', 'unverify', or 'reject'." });
    } catch (err) {
      console.error("Admin updateUserKyc error:", err);
      return res.status(500).json({ error: "Failed to update KYC status" });
    }
  }

  // 7. Get Subscription Plans
  async getPlans(req, res) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, name, profile_views, validity_days, price, description
         FROM subscription_plans ORDER BY id`
      );
      return res.json(rows);
    } catch (err) {
      console.error("Admin getPlans error:", err);
      return res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  }

  // 8. Update Subscription Plan
  async updatePlan(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "Invalid plan ID" });

      const { price, description } = req.body;
      if (price !== undefined && (isNaN(price) || Number(price) < 0)) {
        return res.status(400).json({ error: "Invalid price value" });
      }
      if (description !== undefined && typeof description !== "string") {
        return res.status(400).json({ error: "Invalid description value" });
      }

      const [rows] = await pool.execute(
        `UPDATE subscription_plans
         SET price = coalesce($1, price),
             description = coalesce($2, description)
         WHERE id = $3
         RETURNING id, name, price, description`,
        [price === undefined ? null : Number(price), description ?? null, id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Plan not found" });
      }

      return res.json(rows[0]);
    } catch (err) {
      console.error("Admin updatePlan error:", err);
      return res.status(500).json({ error: "Failed to update subscription plan" });
    }
  }

  // 9. Get User Safety Reports
  async getReports(req, res) {
    try {
      const [rows] = await pool.execute(`
        SELECT r.id, r.reason, r.created_at, r.to_user_id,
               f.first_name || ' ' || coalesce(f.last_name, '') AS from_name,
               t.first_name || ' ' || coalesce(t.last_name, '') AS to_name
        FROM user_reports r
        JOIN users f ON f.id = r.from_user_id
        JOIN users t ON t.id = r.to_user_id
        ORDER BY r.id DESC
        LIMIT 200
      `);

      return res.json(rows);
    } catch (err) {
      console.error("Admin getReports error:", err);
      return res.status(500).json({ error: "Failed to fetch reports" });
    }
  }

  async sendNotification(req, res) {
    const { audience, user_id: rawUserId, title, message } = req.body || {};
    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    const normalizedMessage = typeof message === "string" ? message.trim() : "";

    if (audience !== "all" && audience !== "user") {
      return res.status(400).json({ error: "Choose all users or one user" });
    }
    if (audience === "user" && (!["number", "string"].includes(typeof rawUserId) || !Number.isInteger(Number(rawUserId)) || Number(rawUserId) < 1)) {
      return res.status(400).json({ error: "A valid user ID is required" });
    }
    if (!normalizedTitle || normalizedTitle.length > 100) {
      return res.status(400).json({ error: "Title is required and must be 100 characters or fewer" });
    }
    if (!normalizedMessage || normalizedMessage.length > 1000) {
      return res.status(400).json({ error: "Message is required and must be 1,000 characters or fewer" });
    }

    try {
      const result = await adminNotificationService.send({
        audience,
        userId: audience === "user" ? Number(rawUserId) : null,
        title: normalizedTitle,
        message: normalizedMessage
      });
      return res.status(result.status || 200).json(result);
    } catch (err) {
      console.error("Admin sendNotification error:", err);
      return res.status(500).json({ error: "Failed to send admin notification" });
    }
  }
}

module.exports = new AdminController();
