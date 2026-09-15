/**
 * Standard API response helper matching PHP endpoint contracts
 */

function successResponse(res, messageOrData, data = null) {
  if (typeof messageOrData === "object" && messageOrData !== null && data === null) {
    return res.status(200).json({
      status: true,
      data: messageOrData
    });
  }

  const responseObj = {
    status: true,
    success: 1,
    message: typeof messageOrData === "string" ? messageOrData : "Success"
  };

  if (data !== null) {
    responseObj.data = data;
  }

  return res.status(200).json(responseObj);
}

function errorResponse(res, message = "Something went wrong", statusCode = 200, extra = {}) {
  // PHP endpoints generally returned status HTTP 200 with JSON { status: false, message: "..." } or { success: 0, message: "..." }
  return res.status(statusCode).json({
    status: false,
    success: 0,
    message,
    ...extra
  });
}

module.exports = {
  successResponse,
  errorResponse
};
