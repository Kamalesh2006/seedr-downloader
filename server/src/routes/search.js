const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const results = await searchService.search(q);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error.message || error });
  }
});

module.exports = router;
