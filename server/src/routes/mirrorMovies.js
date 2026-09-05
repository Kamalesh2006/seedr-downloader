const express = require('express');
const router = express.Router();
const movieScraper = require('../services/movieScraperService');
const mirrorDiscovery = require('../services/mirrorDiscoveryService');

// GET /api/mirror/movies
router.get('/movies', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await movieScraper.getMovies(forceRefresh);
    res.json(data);
  } catch (error) {
    console.error('[MirrorRoute] Failed to fetch movies:', error.message);
    const status = mirrorDiscovery.getStatus();
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch movies from mirror',
      status
    });
  }
});

// POST /api/mirror/rediscover
router.post('/rediscover', async (req, res) => {
  try {
    const data = await movieScraper.getMovies(true);
    res.json({
      success: true,
      message: 'Rediscovered mirror and refreshed movie listings',
      ...data
    });
  } catch (error) {
    console.error('[MirrorRoute] Rediscover failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to rediscover mirror'
    });
  }
});

// GET /api/mirror/detail
router.get('/detail', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Detail URL is required' });
    }
    const details = await movieScraper.fetchMovieDetail(url);
    res.json({ success: true, details });
  } catch (error) {
    console.error('[MirrorRoute] Fetch detail failed:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch movie detail' });
  }
});

// POST /api/mirror/config
router.post('/config', async (req, res) => {
  try {
    const { keyword, searchEngine, fallbackDomain } = req.body;
    const configPath = require('path').join(__dirname, '../../config.json');
    const cfg = require('../../config.json');
    if (!cfg.mirrorDiscovery) cfg.mirrorDiscovery = {};

    if (typeof keyword === 'string') cfg.mirrorDiscovery.keyword = keyword.trim();
    if (typeof searchEngine === 'string') cfg.mirrorDiscovery.searchEngine = searchEngine.trim();
    if (typeof fallbackDomain === 'string') cfg.mirrorDiscovery.fallbackDomain = fallbackDomain.trim();

    require('fs').writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');

    // Trigger rediscovery if keyword changed
    let discoveryResult = null;
    if (cfg.mirrorDiscovery.keyword) {
      try {
        discoveryResult = await mirrorDiscovery.discover(true);
      } catch (e) {
        console.warn('[MirrorRoute] Rediscover on config update failed:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      status: mirrorDiscovery.getStatus(),
      discoveryResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update config' });
  }
});

// POST /api/mirror/override
router.post('/override', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    const saved = mirrorDiscovery.setManualDomain(domain);
    res.json({
      success: true,
      message: 'Manual domain override applied',
      data: saved
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to override domain' });
  }
});

// GET /api/mirror/status
router.get('/status', (req, res) => {
  try {
    const status = mirrorDiscovery.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to get status' });
  }
});

module.exports = router;
