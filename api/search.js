const searchService = require('../server/src/services/searchService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
};
