/**
 * Input validation and sanitization middleware for open public API
 */

// Validate and sanitize magnet link
function validateMagnet(req, res, next) {
  let { magnet } = req.body;
  if (!magnet || typeof magnet !== 'string') {
    return res.status(400).json({ error: 'Magnet link is required', code: 'INVALID_INPUT' });
  }

  let trimmed = magnet.trim();

  // Strip zero-width and invisible unicode characters (frequently inserted on mobile keyboards/copy-paste)
  trimmed = trimmed.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ').trim();

  // Strip wrapping quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // Decode URL-encoded magnet (e.g. starts with magnet%3A or %6D%61%67%6E%65%74)
  if (/^magnet%3A/i.test(trimmed) || /^%6D%61%67%6E%65%74/i.test(trimmed)) {
    try {
      trimmed = decodeURIComponent(trimmed);
    } catch (e) {}
  }

  // Extract magnet:?xt= if surrounded by extra text (common when copying from Telegram or web forums on mobile)
  const match = trimmed.match(/magnet:\?[^\s"'<>]+/i);
  if (match) {
    trimmed = match[0].trim();
  } else if (/^magnet:xt=/i.test(trimmed)) {
    trimmed = trimmed.replace(/^magnet:xt=/i, 'magnet:?xt=');
  } else if (/^[a-fA-F0-9]{40}$/.test(trimmed) || /^[a-zA-Z2-7]{32}$/.test(trimmed)) {
    trimmed = `magnet:?xt=urn:btih:${trimmed.toLowerCase()}`;
  } else {
    // Check if raw 40-character hex hash is inside the text
    const hexMatch = trimmed.match(/\b([a-fA-F0-9]{40})\b/);
    if (hexMatch) {
      trimmed = `magnet:?xt=urn:btih:${hexMatch[1].toLowerCase()}`;
    }
  }

  // Max character length check to prevent buffer overflow/DoS
  if (trimmed.length > 4096) {
    return res.status(400).json({ error: 'Magnet link is too long (max 4096 characters)', code: 'PAYLOAD_TOO_LARGE' });
  }

  // Must strictly be a BitTorrent magnet link starting with magnet:?
  if (!trimmed.toLowerCase().startsWith('magnet:?')) {
    return res.status(400).json({ error: 'Invalid URL format. Only standard magnet:? URIs or torrent info hashes are accepted.', code: 'INVALID_MAGNET' });
  }

  // Must contain xt=urn:btih: with valid hash
  const hasBtih = /xt=urn:btih:([a-zA-Z0-9]{32,40})/i.test(trimmed);
  const hasBtihHex = /xt=urn:btih:[a-fA-F0-9]{40}/i.test(trimmed);
  const hasBtihBase32 = /xt=urn:btih:[a-zA-Z2-7]{32}/i.test(trimmed);

  if (!hasBtih && !hasBtihHex && !hasBtihBase32) {
    // Check if at least xt= parameter is present
    if (!/xt=/i.test(trimmed)) {
      return res.status(400).json({ error: 'Invalid magnet link: missing xt (exact topic) parameter.', code: 'INVALID_MAGNET' });
    }
  }

  req.body.magnet = trimmed;
  next();
}

// Validate search query
function validateSearchQuery(req, res, next) {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required', code: 'INVALID_QUERY' });
  }

  const trimmed = q.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Search query cannot be empty', code: 'EMPTY_QUERY' });
  }

  if (trimmed.length > 120) {
    return res.status(400).json({ error: 'Search query is too long (max 120 characters)', code: 'QUERY_TOO_LONG' });
  }

  // Strip non-printable/control characters
  req.query.q = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
  next();
}

// Validate alphanumeric ID parameters to prevent path traversal or malformed requests
function validateIdParam(paramName) {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: `Parameter ${paramName} is required`, code: 'MISSING_PARAM' });
    }

    const trimmed = id.trim();
    // Allow safe alphanumeric, dashes, underscores, and dots (no slash or directory traversal)
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(trimmed) || trimmed.includes('..')) {
      return res.status(400).json({ error: `Invalid ${paramName} format`, code: 'INVALID_PARAM' });
    }

    req.params[paramName] = trimmed;
    next();
  };
}

module.exports = {
  validateMagnet,
  validateSearchQuery,
  validateIdParam
};
