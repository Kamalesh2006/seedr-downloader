const express = require('express');
const router = express.Router();
const seedrService = require('../services/seedrService');
const torrentWatchdog = require('../services/torrentWatchdogService');
const downloadQueue = require('../services/downloadQueueService');

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
    // Storage space freed: trigger queue check
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file', details: error });
  }
});

router.delete('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const result = await seedrService.deleteFolder(folderId);
    res.json(result);
    // Storage space freed: trigger queue check
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete folder', details: error });
  }
});

router.delete('/torrent/:torrentId', async (req, res) => {
  try {
    const { torrentId } = req.params;
    const result = await seedrService.deleteTorrent(torrentId);
    res.json(result);
    // Torrent slot freed: trigger queue check
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete torrent', details: error });
  }
});

router.delete('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await seedrService.deleteTask(taskId);
    res.json(result);
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task', details: error });
  }
});

router.get('/watchdog', (req, res) => {
  res.json(torrentWatchdog.getStatus());
});

module.exports = router;
