const os = require("os");
const app = require("./app");
const env = require("./config/env");

const PORT = env.PORT || 3000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
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

