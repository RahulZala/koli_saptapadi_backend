/**
 * Convert feet/inches string format (e.g., 5' 8" or 5'8) to centimeters
 */
function feetInchStringToCm(heightStr) {
  if (!heightStr || typeof heightStr !== "string") return null;

  const match = heightStr.match(/(\d+)\s*'\s*(\d+)?/);
  if (!match) {
    // Check if it's already a numeric CM string
    const num = parseFloat(heightStr);
    return isNaN(num) ? null : Math.round(num);
  }

  const feet = parseInt(match[1], 10);
  const inches = match[2] ? parseInt(match[2], 10) : 0;

  return Math.round((feet * 30.48) + (inches * 2.54));
}

module.exports = {
  feetInchStringToCm
};
