const { S3Client } = require("@aws-sdk/client-s3");
const env = require("./env");

const isPlaceholder = (val) =>
  !val ||
  val.startsWith("your_") ||
  val.includes("xxxxxxxx");

const hasValidCredentials = Boolean(
  env.CLOUDFLARE_R2_ACCOUNT_ID &&
  !isPlaceholder(env.CLOUDFLARE_R2_ACCOUNT_ID) &&
  env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
  !isPlaceholder(env.CLOUDFLARE_R2_ACCESS_KEY_ID) &&
  env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
  !isPlaceholder(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) &&
  env.CLOUDFLARE_R2_BUCKET_NAME &&
  !isPlaceholder(env.CLOUDFLARE_R2_BUCKET_NAME)
);

const isLive = env.CLOUDFLARE_R2_IS_LIVE === 1 && hasValidCredentials;

let r2Client = null;

if (isLive) {
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    }
  });
}

module.exports = {
  r2Client,
  bucketName: env.CLOUDFLARE_R2_BUCKET_NAME,
  publicUrl: env.CLOUDFLARE_R2_PUBLIC_URL,
  isLive,
  hasValidCredentials
};

