const sharp = require("sharp");

/**
 * High-performance image optimization without visible quality loss.
 * - Auto-rotates using EXIF orientation tags from mobile cameras.
 * - Resizes large images (e.g. 4000px phone camera shots) to standard max dimensions without enlargement.
 * - Converts to optimized WebP format at 82% quality (lossless-like compression).
 *
 * @param {Buffer} buffer - Raw image buffer
 * @param {Object} options - Optimization options
 * @param {number} [options.maxWidth=1600] - Maximum width in pixels
 * @param {number} [options.maxHeight=1600] - Maximum height in pixels
 * @param {number} [options.quality=82] - Quality level (1-100)
 * @param {string} [options.format='webp'] - Output format ('webp' or 'jpeg')
 * @returns {Promise<{ buffer: Buffer, ext: string, mime: string, originalSize: number, optimizedSize: number }>}
 */
async function optimizeImage(buffer, options = {}) {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 82,
    format = "webp"
  } = options;

  const originalSize = buffer.length;

  try {
    let pipeline = sharp(buffer, { failOnError: false }).rotate();

    // Resize inside bounding box without enlarging smaller images
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true
    });

    let optimizedBuffer;
    let ext = "webp";
    let mime = "image/webp";

    if (format === "jpeg" || format === "jpg") {
      optimizedBuffer = await pipeline
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      ext = "jpg";
      mime = "image/jpeg";
    } else {
      optimizedBuffer = await pipeline
        .webp({ quality, effort: 4 })
        .toBuffer();
      ext = "webp";
      mime = "image/webp";
    }

    return {
      buffer: optimizedBuffer,
      ext,
      mime,
      originalSize,
      optimizedSize: optimizedBuffer.length
    };
  } catch (err) {
    console.warn("Sharp image optimization fallback:", err.message);
    // Graceful fallback to original buffer if optimization encounters non-image/corrupted buffer
    return {
      buffer,
      ext: "jpg",
      mime: "image/jpeg",
      originalSize,
      optimizedSize: originalSize
    };
  }
}

module.exports = {
  optimizeImage
};
