const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const { searchLimiter } = require('../middleware/rateLimiter');
const { validateSearchQuery } = require('../middleware/validator');
const { sanitizeErrorMessage } = require('../middleware/errorHandler');

router.get('/', searchLimiter, validateSearchQuery, async (req, res) => {
  try {
    const { q, source, debug } = req.query;
    if (debug === '1' || debug === 'true') {
      const debugData = await searchService.searchWithDebug(q, source);
      return res.json(debugData);
    }
    const results = await searchService.search(q, source);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Search failed' });
  }
});

module.exports = router;
