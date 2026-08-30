const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const { searchLimiter } = require('../middleware/rateLimiter');
const { validateSearchQuery } = require('../middleware/validator');
const { sanitizeErrorMessage } = require('../middleware/errorHandler');

router.get('/', searchLimiter, validateSearchQuery, async (req, res) => {
  try {
    const { q } = req.query;
    const results = await searchService.search(q);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Search failed' });
  }
});

module.exports = router;
