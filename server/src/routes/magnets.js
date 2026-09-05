const express = require('express');
const router = express.Router();
const magnetStorage = require('../services/magnetStorageService');

// GET /api/magnets/recent or /api/magnets/deleted
// Returns deleted magnet links from the past 30 days
const getDeletedHandler = async (req, res) => {
  try {
    const list = await magnetStorage.getDeletedMagnets();
    res.json({ magnets: list });
  } catch (error) {
    console.error('Failed to get deleted magnets:', error);
    res.status(500).json({ error: 'Failed to retrieve deleted magnets', details: error.message || error });
  }
};

router.get('/recent', getDeletedHandler);
router.get('/deleted', getDeletedHandler);

// POST /api/magnets/recent or /api/magnets/deleted
// Records a deleted magnet link (or registers active magnet if action=register)
const postDeletedHandler = async (req, res) => {
  try {
    const { magnet, title, name, id, size, hash, reason, deletedReason, action } = req.body;

    if (action === 'register') {
      const record = magnetStorage.registerActiveMagnet({ magnet, name: title || name, size, id, hash });
      return res.json({ success: true, registered: record });
    }

    if (!magnet && !hash && !id && !name) {
      return res.status(400).json({ error: 'Magnet link, hash, or item identifier is required' });
    }

    const updatedList = await magnetStorage.addDeletedMagnet({
      magnet,
      title: title || name,
      name: name || title,
      id,
      hash,
      size,
      deletedReason: deletedReason || reason || 'Deleted from Seedr',
      deletedAt: new Date().toISOString()
    });

    res.json({ success: true, magnets: updatedList });
  } catch (error) {
    console.error('Failed to record deleted magnet:', error);
    res.status(500).json({ error: 'Failed to save deleted magnet', details: error.message || error });
  }
};

router.post('/recent', postDeletedHandler);
router.post('/deleted', postDeletedHandler);

// DELETE /api/magnets/recent/:id or /api/magnets/deleted/:id (permanently remove an item)
const deleteSingleHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedList = await magnetStorage.removeDeletedMagnet(id);
    res.json({ success: true, magnets: updatedList });
  } catch (error) {
    console.error('Failed to remove deleted magnet:', error);
    res.status(500).json({ error: 'Failed to delete magnet from history', details: error.message || error });
  }
};

router.delete('/recent/:id', deleteSingleHandler);
router.delete('/deleted/:id', deleteSingleHandler);

// DELETE /api/magnets/recent or /api/magnets/deleted (clear all deleted history)
const clearAllHandler = async (req, res) => {
  try {
    const emptyList = await magnetStorage.clearDeletedMagnets();
    res.json({ success: true, magnets: emptyList });
  } catch (error) {
    console.error('Failed to clear deleted magnets:', error);
    res.status(500).json({ error: 'Failed to clear deleted magnets', details: error.message || error });
  }
};

router.delete('/recent', clearAllHandler);
router.delete('/deleted', clearAllHandler);

module.exports = router;
