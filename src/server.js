const app = require("./app");
const env = require("./config/env");

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Koli Saptapadi Express API running on port ${PORT}`);
  // console.log(` Environment: ${env.NODE_ENV}`);
  // console.log(` Timezone: ${env.TIMEZONE}`);
  console.log(`===================================================`);
});
