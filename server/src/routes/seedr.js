const express = require('express');
const router = express.Router();
const seedrService = require('../services/seedrService');
const torrentWatchdog = require('../services/torrentWatchdogService');
const downloadQueue = require('../services/downloadQueueService');
const { seedrActionLimiter } = require('../middleware/rateLimiter');
const { validateMagnet, validateIdParam } = require('../middleware/validator');
const { sanitizeErrorMessage } = require('../middleware/errorHandler');

function parseSizeInGB(sizeStr) {
  if (!sizeStr) return 0;
  if (typeof sizeStr === 'number') {
    return sizeStr / (1024 * 1024 * 1024);
  }
  const match = String(sizeStr).match(/([\d.]+)\s*(GB|MB|KB|B)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return val;
  if (unit === 'MB') return val / 1024;
  if (unit === 'KB') return val / (1024 * 1024);
  if (unit === 'B') return val / (1024 * 1024 * 1024);
  return val;
}

// 1. Add Magnet to Seedr (Rate limited + Magnet validated)
router.post('/add', seedrActionLimiter, validateMagnet, async (req, res) => {
  try {
    const { magnet, name, size } = req.body;

    // Strict check: File size exceeds 4.5 GB limit
    const sizeInGB = parseSizeInGB(size);
    if (sizeInGB > 4.5) {
      return res.status(400).json({ 
        error: `File size (${size || sizeInGB.toFixed(2) + ' GB'}) exceeds Seedr's 4.5 GB total storage limit.`, 
        isOversized: true 
      });
    }

    // Check current Seedr storage and active downloads
    let folderData;
    try {
      folderData = await seedrService.listFolder();
    } catch (e) {
      folderData = {};
    }

    const activeTorrents = folderData.torrents || [];
    const activeTasks = folderData.tasks || [];
    const completedFolders = folderData.folders || [];
    const completedFiles = folderData.files || [];
    const spaceUsed = folderData.space_used || 0;
    const spaceMax = folderData.space_max || (4.5 * 1024 * 1024 * 1024);
    const freeSpaceBytes = Math.max(0, spaceMax - spaceUsed);

    const hasExistingFiles = completedFolders.length > 0 || completedFiles.length > 0;
    const hasActiveDownloads = activeTorrents.length > 0 || activeTasks.length > 0;

    // If there is already an active download or existing files occupying Seedr space:
    // Automatically schedule in Upcoming Queue!
    if (hasActiveDownloads || (hasExistingFiles && freeSpaceBytes < 800 * 1024 * 1024)) {
      const queueItem = downloadQueue.addToQueue({ magnet, name, size });
      return res.json({
        autoQueued: true,
        message: 'Existing files detected in Seedr. Automatically scheduled in Upcoming Queue! (Will auto-start once space is freed)',
        queueItem
      });
    }

    // Attempt direct addition to Seedr
    const result = await seedrService.addMagnet(magnet);

    // Handle Seedr response codes
    if (result) {
      if (result.result === 'file_too_big' || result.error === 'file_too_big') {
        return res.status(400).json({
          error: 'This file exceeds Seedr total 4.5 GB storage capacity limit.',
          isOversized: true
        });
      }

      if (result.result === 'not_enough_space' || result.result === 'free_user_limit' || result.result === false || result.result === 'user_torrent_limit') {
        const queueItem = downloadQueue.addToQueue({ magnet, name, size });
        return res.json({
          autoQueued: true,
          message: 'Seedr storage is currently full. Automatically scheduled in Upcoming Queue! (Will auto-start once space is freed)',
          queueItem
        });
      }
    }

    res.json(result);
  } catch (error) {
    const errorMsg = sanitizeErrorMessage(error);
    
    if (errorMsg.includes('file_too_big')) {
      return res.status(400).json({
        error: 'This file exceeds Seedr total 4.5 GB storage capacity limit.',
        isOversized: true
      });
    }

    if (errorMsg.includes('not_enough_space') || errorMsg.includes('free_user_limit') || errorMsg.includes('user_torrent_limit') || errorMsg.includes('wishlist')) {
      const { magnet, name, size } = req.body;
      const queueItem = downloadQueue.addToQueue({ magnet, name, size });
      return res.json({
        autoQueued: true,
        message: 'Seedr storage is currently full. Automatically scheduled in Upcoming Queue! (Will auto-start once space is freed)',
        queueItem
      });
    }

    res.status(500).json({ error: errorMsg || 'Failed to add magnet' });
  }
});

router.get('/status/:transferId', validateIdParam('transferId'), async (req, res) => {
  try {
    const { transferId } = req.params;
    const result = await seedrService.getTransferStatus(transferId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to get transfer status' });
  }
});

router.get('/folders', async (req, res) => {
  try {
    const result = await seedrService.listFolder();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to list root folder' });
  }
});

router.get('/folder/:id', validateIdParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await seedrService.listFolder(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to list folder' });
  }
});

router.get('/download/:fileId', validateIdParam('fileId'), async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await seedrService.getDownloadUrl(fileId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to get download URL' });
  }
});

// Direct stream redirect for external media players (VLC, IINA, MPV, Kodi)
router.get('/stream/:fileId', validateIdParam('fileId'), async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await seedrService.getDownloadUrl(fileId);
    if (result && result.url) {
      return res.redirect(302, result.url);
    }
    res.status(404).json({ error: 'Stream URL not found' });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to get stream URL' });
  }
});

// M3U Playlist file generation for instant 1-click VLC playback
router.get('/playlist/:fileId', validateIdParam('fileId'), async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await seedrService.getDownloadUrl(fileId);
    if (!result || !result.url) {
      return res.status(404).json({ error: 'Stream URL not found' });
    }
    const fileName = (result.name || `seedr-video-${fileId}`).replace(/["\r\n]/g, '');
    const m3uContent = `#EXTM3U\n#EXTINF:-1,${fileName}\n${result.url}\n`;
    
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.m3u"`);
    res.send(m3uContent);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to generate playlist' });
  }
});

router.delete('/file/:fileId', validateIdParam('fileId'), async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await seedrService.deleteFile(fileId);
    res.json(result);
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete file' });
  }
});

router.delete('/folder/:folderId', validateIdParam('folderId'), async (req, res) => {
  try {
    const { folderId } = req.params;
    const result = await seedrService.deleteFolder(folderId);
    res.json(result);
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete folder' });
  }
});

router.delete('/torrent/:torrentId', validateIdParam('torrentId'), async (req, res) => {
  try {
    const { torrentId } = req.params;
    const result = await seedrService.deleteTorrent(torrentId);
    res.json(result);
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete torrent' });
  }
});

router.delete('/task/:taskId', validateIdParam('taskId'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await seedrService.deleteTask(taskId);
    res.json(result);
    setTimeout(() => downloadQueue.processNext(), 2000);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete task' });
  }
});

router.get('/watchdog', (req, res) => {
  res.json(torrentWatchdog.getStatus());
});

module.exports = router;

