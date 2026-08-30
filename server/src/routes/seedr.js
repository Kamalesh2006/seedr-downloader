const express = require('express');
const router = express.Router();
const seedrService = require('../services/seedrService');

router.post('/add', async (req, res) => {
  try {
    const { magnet } = req.body;
    if (!magnet) {
      return res.status(400).json({ error: 'Magnet link is required' });
    }
    const result = await seedrService.addMagnet(magnet);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add magnet', details: error });
  }
});

router.get('/status/:transferId', async (req, res) => {
  try {
    const { transferId } = req.params;
    const result = await seedrService.getTransferStatus(transferId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get transfer status', details: error });
  }
});

router.get('/folders', async (req, res) => {
  try {
    const result = await seedrService.listFolder();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list root folder', details: error });
  }
});

router.get('/folder/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await seedrService.listFolder(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list folder', details: error });
  }
});

router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await seedrService.getDownloadUrl(fileId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get download URL', details: error });
  }
});

router.delete('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await seedrService.deleteFile(fileId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file', details: error });
  }
});

router.delete('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const result = await seedrService.deleteFolder(folderId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete folder', details: error });
  }
});

module.exports = router;
