const authService = require("../services/auth.service");

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async sendOTP(req, res, next) {
    try {
      const phone = req.body.phone || req.body.to || req.query.phone || req.query.to;
      if (!phone) {
        return res.status(400).json({ success: 0, message: "Phone number required" });
      }
      const result = await authService.sendOTP(phone);
      return res.status(result.success === 1 ? 200 : 502).json(result);
    } catch (err) {
      next(err);
    }
  }

  async verifyOTP(req, res, next) {
    try {
      const phone = req.body.phone || req.body.to || req.query.phone || req.query.to;
      const otp = req.body.otp || req.body.code || req.query.otp || req.query.code;
      const result = await authService.verifyOTP(phone, otp);
      const statusCode = result.success === 1 ? 200 : 200;
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      const result = await authService.logout(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      const result = await authService.deleteAccount(req.userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
