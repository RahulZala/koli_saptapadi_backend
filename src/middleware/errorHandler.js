/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  console.error("Unhandled Error:", err);

  const status = err.statusCode || 200;
  const message = process.env.NODE_ENV === "production"
    ? "Internal Server Error"
    : err.message || "An unexpected error occurred";

  return res.status(status).json({
    status: false,
    success: 0,
    message
  });
}

module.exports = errorHandler;
