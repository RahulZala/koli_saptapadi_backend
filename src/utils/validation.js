/**
 * Base64 image validator matching PHP validateBase64Image behavior
 */
function validateBase64Image(base64Str) {
  if (!base64Str || typeof base64Str !== "string") {
    return { ok: false, error: "Image is required" };
  }

  let cleanBase64 = base64Str.trim();
  if (!cleanBase64) {
    return { ok: false, error: "Image cannot be blank" };
  }

  if (/^data:image\/(png|jpeg|jpg|webp);base64,/.test(cleanBase64)) {
    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
  }

  cleanBase64 = cleanBase64.replace(/ /g, "+");
  let buffer;
  try {
    buffer = Buffer.from(cleanBase64, "base64");
  } catch (e) {
    return { ok: false, error: "Invalid base64 image data" };
  }

  if (!buffer || buffer.length === 0 || buffer.length < 50) {
    return { ok: false, error: "Image cannot be blank or empty" };
  }

  // 10 MB limit check
  if (buffer.length > 10 * 1024 * 1024) {
    return { ok: false, error: "Image size exceeds 10MB limit" };
  }

  // Simple magic numbers check for PNG / JPEG / WebP
  let ext = "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    ext = "png";
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    ext = "jpg";
  } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    ext = "webp";
  }

  return { ok: true, buffer, ext };
}

module.exports = {
  validateBase64Image
};
