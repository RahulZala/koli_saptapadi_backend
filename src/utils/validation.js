/**
 * Base64 image validator matching PHP validateBase64Image behavior
 */
function validateBase64Image(base64Str) {
  if (!base64Str || typeof base64Str !== "string") {
    return { ok: false, error: "empty" };
  }

  let cleanBase64 = base64Str;
  if (/^data:image\/(png|jpeg|jpg);base64,/.test(cleanBase64)) {
    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
  }

  cleanBase64 = cleanBase64.replace(/ /g, "+");
  const buffer = Buffer.from(cleanBase64, "base64");

  if (!buffer || buffer.length === 0) {
    return { ok: false, error: "base64_decode_failed" };
  }

  // 10 MB limit check
  if (buffer.length > 10 * 1024 * 1024) {
    return { ok: false, error: "file_too_large" };
  }

  // Simple magic numbers check for PNG / JPEG
  let ext = "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    ext = "png";
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    ext = "jpg";
  }

  return { ok: true, buffer, ext };
}

module.exports = {
  validateBase64Image
};
