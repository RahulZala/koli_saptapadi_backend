const pool = require("../config/database");

/**
 * Authentication middleware matching PHP auth.php behavior:
 * Reads Authorization header: 'Bearer <token>'
 * Finds user in `users` table via `api_token`.
 * Rejects if user missing or is_active == 0.
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];

    if (!authHeader || typeof authHeader !== "string") {
      return res.status(200).json({
        status: false,
        message: "Authorization header missing"
      });
    }

    const parts = authHeader.trim().split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return res.status(200).json({
        status: false,
        message: "Invalid authorization format"
      });
    }

    const token = parts[1].trim();
    if (!token) {
      return res.status(200).json({
        status: false,
        message: "Token missing"
      });
    }

    const [rows] = await pool.execute(
      "SELECT id, is_active, phone, first_name, last_name FROM users WHERE api_token = $1",
      [token]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        status: false,
        message: "Invalid or expired token"
      });
    }

    const user = rows[0];

    if (parseInt(user.is_active, 10) === 0) {
      return res.status(200).json({
        status: false,
        message: "Your account is deactivated. Please contact support."
      });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(200).json({
      status: false,
      message: "Authentication error"
    });
  }
}

module.exports = {
  authenticateUser
};
