const express = require('express');
const axios = require('axios');
const router = express.Router();
const acestreamService = require('../services/acestreamService');

/**
 * GET /api/acestream/status
 * Check if the Ace Stream Engine daemon is alive
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await acestreamService.checkEngineStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/acestream/validate?id=...
 * Validates whether an ID is a valid Ace Stream hash
 */
router.get('/validate', (req, res) => {
  const { id } = req.query;
  try {
    const cleanId = acestreamService.sanitizeId(id);
    res.json({
      valid: true,
      id: cleanId,
      acestreamUrl: `acestream://${cleanId}`
    });
  } catch (err) {
    res.status(400).json({
      valid: false,
      error: err.message
    });
  }
});

/**
 * GET /api/acestream/playlist.m3u?id=...&title=...
 * Generates and downloads an M3U playlist file for VLC / external players
 */
router.get('/playlist.m3u', (req, res) => {
  const { id, title } = req.query;
  try {
    const cleanId = acestreamService.sanitizeId(id);
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    const m3uContent = acestreamService.generateM3U(cleanId, baseUrl, title);

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="acestream-${cleanId.substring(0, 8)}.m3u"`);
    res.send(m3uContent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/acestream/hls/manifest.m3u8?id=...
 * Proxies the HLS manifest from the Ace Stream engine, rewriting segment URLs
 * so the browser can stream directly without CORS/internal network barriers.
 */
router.get('/hls/manifest.m3u8', async (req, res, next) => {
  const { id } = req.query;
  try {
    const cleanId = acestreamService.sanitizeId(id);
    const engineHlsUrl = acestreamService.getEngineHlsUrl(cleanId);

    const upstreamRes = await axios.get(engineHlsUrl, {
      timeout: 10000,
      responseType: 'text',
      validateStatus: () => true
    });

    if (upstreamRes.status !== 200) {
      return res.status(upstreamRes.status).json({
        error: `Ace Stream Engine returned HTTP ${upstreamRes.status}`,
        details: upstreamRes.data
      });
    }

    const rawManifest = upstreamRes.data;
    const engineOrigin = new URL(acestreamService.engineUrl).origin;

    // Rewrite segment lines in the manifest to route through our proxy
    const rewritten = rawManifest.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }

      // Resolving segment URL
      let targetSegmentUrl;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        targetSegmentUrl = trimmed;
      } else if (trimmed.startsWith('/')) {
        targetSegmentUrl = `${engineOrigin}${trimmed}`;
      } else {
        targetSegmentUrl = `${engineOrigin}/ace/${trimmed}`;
      }

      return `/api/acestream/hls/segment?url=${encodeURIComponent(targetSegmentUrl)}`;
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Ace Stream Engine is offline. Start the engine or check configuration.',
        engineUrl: acestreamService.engineUrl
      });
    }
    next(err);
  }
});

/**
 * GET /api/acestream/hls/segment?url=...
 * Proxies individual HLS .ts chunks
 */
router.get('/hls/segment', async (req, res, next) => {
  const { url: segmentUrl } = req.query;
  if (!segmentUrl) {
    return res.status(400).json({ error: 'Segment URL is required' });
  }

  const cancelTokenSource = axios.CancelToken.source();

  req.on('close', () => {
    cancelTokenSource.cancel('Client closed connection');
  });

  try {
    const upstreamRes = await axios({
      method: 'GET',
      url: segmentUrl,
      responseType: 'stream',
      timeout: 15000,
      cancelToken: cancelTokenSource.token,
      headers: {
        ...(req.headers.range ? { range: req.headers.range } : {})
      }
    });

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (upstreamRes.headers['content-length']) {
      res.setHeader('Content-Length', upstreamRes.headers['content-length']);
    }

    upstreamRes.data.pipe(res);
  } catch (err) {
    if (axios.isCancel(err)) {
      return;
    }
    next(err);
  }
});

/**
 * GET /api/acestream/stream?id=...
 * Pipes the direct MPEG-TS stream from the Ace Stream engine.
 * Suitable for VLC, MPV, or players that accept MPEG-TS streams.
 */
router.get('/stream', async (req, res, next) => {
  const { id } = req.query;
  try {
    const cleanId = acestreamService.sanitizeId(id);
    const engineStreamUrl = acestreamService.getEngineStreamUrl(cleanId);

    const cancelTokenSource = axios.CancelToken.source();

    req.on('close', () => {
      cancelTokenSource.cancel('Client disconnected stream');
    });

    const upstreamRes = await axios({
      method: 'GET',
      url: engineStreamUrl,
      responseType: 'stream',
      timeout: 20000,
      cancelToken: cancelTokenSource.token,
      headers: {
        'User-Agent': 'Seedr-AceStream-Proxy/1.0',
        ...(req.headers.range ? { range: req.headers.range } : {})
      }
    });

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store');

    upstreamRes.data.pipe(res);
  } catch (err) {
    if (axios.isCancel(err)) {
      return;
    }
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Ace Stream Engine is offline. Start the engine or check configuration.',
        engineUrl: acestreamService.engineUrl
      });
    }
    next(err);
  }
});

module.exports = router;
