function validateBase64Image(base64Str) {
  if (!base64Str || typeof base64Str !== "string") {
    return { ok: false, error: "empty" };
  }

  let cleanBase64 = base64Str;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/.test(cleanBase64)) {
    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
  }

  cleanBase64 = cleanBase64.replace(/ /g, "+");
  const buffer = Buffer.from(cleanBase64, "base64");

  if (!buffer || buffer.length === 0) {
    return { ok: false, error: "base64_decode_failed" };
  }

  // 25 MB limit check
  if (buffer.length > 25 * 1024 * 1024) {
    return { ok: false, error: "file_too_large" };
  }

  // Magic numbers check for PNG / JPEG / WEBP
  let ext = "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    ext = "png";
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    ext = "jpg";
  } else if (buffer.length > 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    ext = "webp";
  }

  return { ok: true, buffer, ext };
}

/**
 * Resolves an image input from either a Base64 string OR a direct HTTP(S) URL (from Cloudflare R2 direct upload).
 */
async function resolveImageInput(input) {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "empty" };
  }

  const trimmed = input.trim();

  // 1. Direct URL (Cloudflare R2 public URL, S3 URL, or HTTP/HTTPS image URL)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const response = await fetch(trimmed);
      if (!response.ok) {
        return { ok: false, error: `fetch_failed_status_${response.status}` };
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!buffer || buffer.length === 0) {
        return { ok: false, error: "empty_image_response" };
      }

      if (buffer.length > 25 * 1024 * 1024) {
        return { ok: false, error: "file_too_large" };
      }

      let ext = "jpg";
      let mime = "image/jpeg";
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        ext = "png";
        mime = "image/png";
      } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        ext = "jpg";
        mime = "image/jpeg";
      } else if (buffer.length > 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        ext = "webp";
        mime = "image/webp";
      }

      return {
        ok: true,
        buffer,
        ext,
        mime,
        isUrl: true,
        url: trimmed
      };
    } catch (err) {
      return { ok: false, error: `image_download_failed: ${err.message}` };
    }
  }

  // 2. Base64 encoded string
  const base64Res = validateBase64Image(trimmed);
  if (!base64Res.ok) {
    return base64Res;
  }

  return {
    ok: true,
    buffer: base64Res.buffer,
    ext: base64Res.ext,
    mime: base64Res.ext === "png" ? "image/png" : base64Res.ext === "webp" ? "image/webp" : "image/jpeg",
    isUrl: false
  };
}

module.exports = {
  validateBase64Image,
  resolveImageInput
};
