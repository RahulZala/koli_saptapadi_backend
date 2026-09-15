/**
 * Middleware to normalize legacy PHP paths into standard Express route paths.
 * E.g., /api/calls/send_otp.php -> /api/calls/send_otp
 * /calls/send_otp.php -> /api/calls/send_otp
 * /login.php -> /api/calls/login
 */
function routeAlias(req, res, next) {
  let url = req.url;

  // Remove .php extension if present
  if (url.includes(".php")) {
    url = url.replace(/\.php(\?.*)?$/, "$1");
  }

  // Handle root level login.php or /api/login
  if (url === "/login" || url.startsWith("/login?")) {
    url = url.replace("/login", "/api/calls/login");
  } else if (url.startsWith("/calls/")) {
    url = "/api" + url;
  } else if (!url.startsWith("/api/calls/") && !url.startsWith("/api/")) {
    // If sent directly as /send_otp
    url = "/api/calls" + (url.startsWith("/") ? url : "/" + url);
  }

  req.url = url;
  next();
}

module.exports = routeAlias;
