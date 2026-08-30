const rateLimit = require('express-rate-limit');

// 1. General API Limiter (120 reqs / minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down and try again shortly.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// 2. Search Endpoint Limiter (30 searches / minute to prevent upstream scraping abuse)
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Search rate limit exceeded. Please wait a moment before searching again.',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED'
  }
});

// 3. Seedr Add Magnet Limiter (15 adds / minute to protect Seedr account from spam flooding)
const seedrActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Torrent submission rate limit reached. Please wait a moment.',
    code: 'ACTION_RATE_LIMIT_EXCEEDED'
  }
});

// 4. Queue Manipulation Limiter (35 actions / minute)
const queueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Queue rate limit reached. Please wait a moment.',
    code: 'QUEUE_RATE_LIMIT_EXCEEDED'
  }
});

module.exports = {
  apiLimiter,
  searchLimiter,
  seedrActionLimiter,
  queueLimiter
};
