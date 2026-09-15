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
      const { phone } = req.body;
      const result = await authService.sendOTP(phone);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async verifyOTP(req, res, next) {
    try {
      const { phone, otp } = req.body;
      const result = await authService.verifyOTP(phone, otp);
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
