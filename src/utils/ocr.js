const Tesseract = require("tesseract.js");
const sharp = require("sharp");

/**
 * Pre-processes an image buffer for optimal OCR text recognition.
 * Enhances contrast, converts to grayscale, and sharpens text edges.
 */
async function preprocessForOCR(imageBuffer) {
  try {
    return await sharp(imageBuffer, { failOnError: false })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
  } catch (err) {
    return imageBuffer;
  }
}

/**
 * Extracts text from an image buffer using Tesseract OCR with a strict timeout.
 * Guaranteed to never hang or block serverless functions.
 * @param {Buffer} imageBuffer
 * @param {number} [timeoutMs=2500]
 * @returns {Promise<{ text: string, confidence: number, lines: string[] }>}
 */
async function extractTextFromImage(imageBuffer, timeoutMs = 2500) {
  try {
    const ocrPromise = (async () => {
      const preprocessed = await preprocessForOCR(imageBuffer);
      const result = await Tesseract.recognize(preprocessed, "eng", {
        logger: () => {} // Silent logger
      });

      const text = result?.data?.text || "";
      const confidence = result?.data?.confidence || 0;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      return {
        text,
        confidence,
        lines
      };
    })();

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ text: "", confidence: 0, lines: [], timed_out: true }), timeoutMs)
    );

    return await Promise.race([ocrPromise, timeoutPromise]);
  } catch (err) {
    console.warn("OCR Extraction Notice:", err.message);
    return {
      text: "",
      confidence: 0,
      lines: []
    };
  }
}

module.exports = {
  extractTextFromImage,
  preprocessForOCR
};
