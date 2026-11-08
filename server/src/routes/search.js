const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const { searchLimiter } = require('../middleware/rateLimiter');
const { validateSearchQuery } = require('../middleware/validator');
const { sanitizeErrorMessage } = require('../middleware/errorHandler');

router.get('/', searchLimiter, validateSearchQuery, async (req, res) => {
  try {
    const { q, source, debug, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 60));

    if (debug === '1' || debug === 'true') {
      const debugData = await searchService.searchWithDebug(q, source, pageNum);
      return res.json(debugData);
    }
    const results = await searchService.search(q, source, pageNum, limitNum);
    const hasMore = results.length >= 15;
    const totalPages = Math.max(1, hasMore ? pageNum + 1 : pageNum);

    res.json({
      results,
      page: pageNum,
      totalPages,
      totalCount: results.length,
      hasMore
    });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Search failed' });
  }
});

module.exports = router;
