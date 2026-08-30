const express = require('express');
const router = express.Router();
const downloadQueueService = require('../services/downloadQueueService');

// Helper to extract magnet display name in Node.js
function parseName(magnet, providedName) {
  if (providedName && providedName.trim()) return providedName.trim();
  try {
    const dnMatch = magnet.match(/[?&]dn=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      return decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim();
    }
  } catch (e) {}
  return 'Scheduled Torrent';
}

router.get('/', (req, res) => {
  try {
    const status = downloadQueueService.getQueueStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get queue', details: err.message });
  }
});

router.post('/add', (req, res) => {
  try {
    const { magnet, name, size } = req.body;
    if (!magnet) {
      return res.status(400).json({ error: 'Magnet link is required' });
    }

    const finalName = parseName(magnet, name);
    const item = downloadQueueService.addToQueue({ magnet, name: finalName, size });
    res.json({ success: true, item, queue: downloadQueueService.queue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item to queue', details: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = downloadQueueService.removeFromQueue(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove queue item', details: err.message });
  }
});

router.post('/move', (req, res) => {
  try {
    const { id, direction } = req.body;
    const result = downloadQueueService.moveItem(id, direction);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to move queue item', details: err.message });
  }
});

router.post('/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body;
    const result = downloadQueueService.reorderQueue(orderedIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder queue', details: err.message });
  }
});

router.post('/clear', (req, res) => {
  try {
    const result = downloadQueueService.clearQueue();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear queue', details: err.message });
  }
});

router.post('/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const result = downloadQueueService.toggleAutoProcessor(enabled);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle auto processor', details: err.message });
  }
});

router.post('/process-now', async (req, res) => {
  try {
    await downloadQueueService.processNext();
    res.json({ success: true, message: 'Processing triggered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger queue processing', details: err.message });
  }
});

module.exports = router;
