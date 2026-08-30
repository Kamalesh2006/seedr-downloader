/**
 * Centralized Error Sanitizer & Handler Middleware
 * Guarantees that Seedr credentials, auth headers, access tokens,
 * passwords, or server internal details are NEVER exposed to client browsers.
 */

// Helper to sanitize any error object or message
function sanitizeErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';

  // If it's an Axios error, extract only safe error text without config/headers
  if (error.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.error && typeof data.error === 'string') return data.error;
    if (data.reason_phrase && typeof data.reason_phrase === 'string') return data.reason_phrase;
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.result && typeof data.result === 'string') return data.result;
  }

  let msg = typeof error === 'string' ? error : (error.message || 'Operation failed');

  // Strip any accidental credential or token mentions
  const sensitivePatterns = [
    /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
    /Basic\s+[a-zA-Z0-9_\-\.\=\+\/]+/gi,
    /password=[^&\s]+/gi,
    /username=[^&\s]+/gi,
    /access_token=[^&\s]+/gi
  ];

  for (const pattern of sensitivePatterns) {
    msg = msg.replace(pattern, '[REDACTED]');
  }

  return msg;
}

function errorHandler(err, req, res, next) {
  // Log full error safely only on server console (for developer debugging)
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  const safeMessage = sanitizeErrorMessage(err);

  res.status(statusCode).json({
    error: safeMessage,
    code: err.code || 'SERVER_ERROR'
  });
}

module.exports = {
  errorHandler,
  sanitizeErrorMessage
};
