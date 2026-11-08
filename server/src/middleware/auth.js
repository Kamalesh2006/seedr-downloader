const jwt = require('jsonwebtoken');
const defaultSeedrService = require('../services/seedrService');
const { createUserSeedrService } = defaultSeedrService;

const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'seedr_stateless_secret_key_session';

function generateToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Middleware that extracts user credentials from token if present,
 * or gracefully falls back to Guest Mode using the server default Seedr account.
 */
function extractAuth(req, res, next) {
  const isExplicitGuest = req.headers['x-guest-mode'] === 'true';

  let rawToken = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawToken = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    rawToken = req.query.token;
  } else if (req.headers['x-seedr-token']) {
    rawToken = req.headers['x-seedr-token'];
  }

  if (!isExplicitGuest && rawToken) {
    const decoded = verifyToken(rawToken);
    if (decoded && decoded.accessToken) {
      req.user = {
        isGuest: false,
        userId: decoded.userId || null,
        email: decoded.email || null,
        username: decoded.username || null,
        premium: !!decoded.premium,
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken || null
      };

      req.seedr = createUserSeedrService({
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken
      });

      return next();
    }
  }

  // Fallback to Guest Mode (Server Seedr Account)
  req.user = {
    isGuest: true,
    userId: 'guest',
    email: 'Guest',
    username: 'Guest',
    premium: false
  };
  req.seedr = defaultSeedrService;
  next();
}

/**
 * Middleware that strictly requires a logged-in user account.
 */
function requireAuth(req, res, next) {
  extractAuth(req, res, () => {
    if (req.user && !req.user.isGuest) {
      return next();
    }
    return res.status(401).json({ error: 'Authentication required. Please log in with your Seedr account.' });
  });
}

module.exports = {
  extractAuth,
  requireAuth,
  generateToken,
  verifyToken,
  JWT_SECRET
};

