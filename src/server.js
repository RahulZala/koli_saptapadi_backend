const os = require("os");
const app = require("./app");
const env = require("./config/env");

const PORT = env.PORT || 3000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  const interfaces = os.networkInterfaces();
  const networkAddresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        networkAddresses.push(net.address);
      }
    }
  }

  console.log(`===================================================`);
  console.log(` Koli Saptapadi Express API is Running`);
  console.log(` - Local:    http://localhost:${PORT}`);
  networkAddresses.forEach((ip) => {
    console.log(` - Network:  http://${ip}:${PORT}`);
  });
  console.log(`===================================================`);
  console.log(` For Android Mobile (on same Wi-Fi network):`);
  networkAddresses.forEach((ip) => {
    console.log(` Base URL: http://${ip}:${PORT}/api`);
  });
  console.log(`===================================================`);
});

// Handle Server-level Errors (e.g., Port already in use EADDRINUSE)
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[ERROR] Port ${PORT} is already in use by another process!`);
    console.error(`[FIX] 1. Stop the existing process running on port ${PORT}, OR`);
    console.error(`[FIX] 2. Change the PORT in .env (e.g. PORT=3001)\n`);
  } else {
    console.error(`\n[SERVER ERROR]`, err.message, `\n`);
  }
  process.exit(1);
});

// Uncaught Exception & Rejection Handlers
process.on("uncaughtException", (err) => {
  console.error("\n[FATAL] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
});


