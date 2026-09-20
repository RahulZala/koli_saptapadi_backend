/**
 * Date and timezone helper functions matching PHP User.php behavior
 */

function getCurrentDate() {
  const now = new Date();
  // Adjust for Asia/Kolkata (+5.5 UTC)
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kolkataTime = new Date(utc + kolkataOffsetMs);
  return kolkataTime.toISOString().split("T")[0];
}

function getCurrentDateTime() {
  const now = new Date();
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kolkataTime = new Date(utc + kolkataOffsetMs);
  return kolkataTime.toISOString().slice(0, 19).replace("T", " ");
}

function getExpiryDateTimeMinutes(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function timeAgo(datetimeStr) {
  if (!datetimeStr) return "";
  let timestamp;
  if (datetimeStr instanceof Date) {
    timestamp = datetimeStr.getTime() / 1000;
  } else {
    const str = String(datetimeStr).trim();
    const isoStr = str.includes("T") ? str : str.replace(" ", "T");
    const dateObj = new Date(isoStr.endsWith("Z") ? isoStr : isoStr + "Z");
    timestamp = isNaN(dateObj.getTime()) ? new Date(datetimeStr).getTime() / 1000 : dateObj.getTime() / 1000;
  }
  const currentTime = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, currentTime - timestamp);

  if (diff < 10) {
    return "Just now";
  } else if (diff < 60) {
    return `${diff} sec ago`;
  } else if (diff < 3600) {
    return `${Math.floor(diff / 60)} min ago`;
  } else if (diff < 86400) {
    return `${Math.floor(diff / 3600)} hours ago`;
  } else if (diff < 604800) {
    return `${Math.floor(diff / 86400)} days ago`;
  } else if (diff < 2592000) {
    return `${Math.floor(diff / 604800)} weeks ago`;
  } else if (diff < 31536000) {
    return `${Math.floor(diff / 2592000)} months ago`;
  } else {
    return `${Math.floor(diff / 31536000)} years ago`;
  }
}

module.exports = {
  getCurrentDate,
  getCurrentDateTime,
  getExpiryDateTimeMinutes,
  timeAgo
};
