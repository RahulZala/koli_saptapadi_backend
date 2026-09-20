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
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
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
 * Extracts text from an image buffer using Tesseract OCR.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ text: string, confidence: number, lines: string[] }>}
 */
async function extractTextFromImage(imageBuffer) {
  try {
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
  } catch (err) {
    console.error("OCR Extraction Error:", err);
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
