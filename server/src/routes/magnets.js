const express = require('express');
const router = express.Router();
const magnetStorage = require('../services/magnetStorageService');

// GET /api/magnets/recent
router.get('/recent', async (req, res) => {
  try {
    const list = await magnetStorage.getRecentMagnets();
    res.json({ magnets: list });
  } catch (error) {
    console.error('Failed to get recent magnets:', error);
    res.status(500).json({ error: 'Failed to retrieve recent magnets', details: error.message || error });
  }
});

// POST /api/magnets/recent
router.post('/recent', async (req, res) => {
  try {
    const { magnet, title, name, id, size, status, progress, files } = req.body;
    if (!magnet) {
      return res.status(400).json({ error: 'Magnet is required' });
    }
    const updatedList = await magnetStorage.addRecentMagnet({
      magnet,
      title: title || name,
      name: name || title,
      id,
      size,
      status,
      progress,
      files
    });
    res.json({ success: true, magnets: updatedList });
  } catch (error) {
    console.error('Failed to add recent magnet:', error);
    res.status(500).json({ error: 'Failed to save recent magnet', details: error.message || error });
  }
});

// PUT /api/magnets/recent/:id
router.put('/recent/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedList = await magnetStorage.updateRecentMagnet(id, updates);
    res.json({ success: true, magnets: updatedList });
  } catch (error) {
    console.error('Failed to update recent magnet:', error);
    res.status(500).json({ error: 'Failed to update recent magnet', details: error.message || error });
  }
});

// DELETE /api/magnets/recent/:id
router.delete('/recent/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedList = await magnetStorage.removeRecentMagnet(id);
    res.json({ success: true, magnets: updatedList });
  } catch (error) {
    console.error('Failed to remove recent magnet:', error);
    res.status(500).json({ error: 'Failed to delete recent magnet', details: error.message || error });
  }
});

// DELETE /api/magnets/recent (clear all)
router.delete('/recent', async (req, res) => {
  try {
    const emptyList = await magnetStorage.clearRecentMagnets();
    res.json({ success: true, magnets: emptyList });
  } catch (error) {
    console.error('Failed to clear recent magnets:', error);
    res.status(500).json({ error: 'Failed to clear recent magnets', details: error.message || error });
  }
});

module.exports = router;
