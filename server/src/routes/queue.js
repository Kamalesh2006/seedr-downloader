const express = require('express');
const router = express.Router();
const downloadQueueService = require('../services/downloadQueueService');
const { queueLimiter } = require('../middleware/rateLimiter');
const { validateMagnet, validateIdParam } = require('../middleware/validator');
const { sanitizeErrorMessage } = require('../middleware/errorHandler');

// Helper to extract magnet display name safely in Node.js
function parseName(magnet, providedName) {
  if (providedName && typeof providedName === 'string' && providedName.trim()) {
    return providedName.trim().slice(0, 255);
  }
  try {
    const dnMatch = magnet.match(/[?&]dn=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      return decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim().slice(0, 255);
    }
  } catch (e) {}
  return 'Scheduled Torrent';
}

router.get('/', (req, res) => {
  try {
    const status = downloadQueueService.getQueueStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to get queue' });
  }
});

router.post('/add', queueLimiter, validateMagnet, (req, res) => {
  try {
    const { magnet, name, size } = req.body;
    const finalName = parseName(magnet, name);
    const item = downloadQueueService.addToQueue({ magnet, name: finalName, size });
    res.json({ success: true, item, queue: downloadQueueService.queue });
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to add item to queue' });
  }
});

router.delete('/:id', queueLimiter, validateIdParam('id'), (req, res) => {
  try {
    const { id } = req.params;
    const result = downloadQueueService.removeFromQueue(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to remove queue item' });
  }
});

router.post('/move', queueLimiter, (req, res) => {
  try {
    const { id, direction } = req.body;
    if (!id || typeof id !== 'string' || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid move parameters' });
    }
    const result = downloadQueueService.moveItem(id.trim(), direction);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to move queue item' });
  }
});

router.post('/reorder', queueLimiter, (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array' });
    }
    const result = downloadQueueService.reorderQueue(orderedIds.slice(0, 100));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to reorder queue' });
  }
});

router.post('/clear', queueLimiter, (req, res) => {
  try {
    const result = downloadQueueService.clearQueue();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to clear queue' });
  }
});

router.post('/toggle', queueLimiter, (req, res) => {
  try {
    const { enabled } = req.body;
    const result = downloadQueueService.toggleAutoProcessor(enabled);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to toggle auto processor' });
  }
});

router.post('/process-now', queueLimiter, async (req, res) => {
  try {
    await downloadQueueService.processNext();
    res.json({ success: true, message: 'Processing triggered' });
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err) || 'Failed to trigger queue processing' });
  }
});

module.exports = router;
