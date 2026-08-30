const express = require('express');
const router = express.Router();
const seedrService = require('../services/seedrService');
const torrentWatchdog = require('../services/torrentWatchdogService');
const downloadQueue = require('../services/downloadQueueService');

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

router.post('/add', async (req, res) => {
  try {
    const { magnet, name, size } = req.body;
    if (!magnet) {
      return res.status(400).json({ error: 'Magnet link is required' });
    }

    // 1. Strict check: File size exceeds 4.5 GB limit
    const sizeInGB = parseSizeInGB(size);
    if (sizeInGB > 4.5) {
      console.warn(`[Seedr] ⚠️ Blocked addition of oversized torrent "${name || 'Torrent'}" (${sizeInGB.toFixed(2)} GB > 4.5 GB limit).`);
      return res.status(400).json({ 
        error: `File size (${size || sizeInGB.toFixed(2) + ' GB'}) exceeds Seedr's 4.5 GB total storage limit.`, 
        isOversized: true 
      });
    }

    // 2. Check current Seedr storage and active downloads
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

    const hasExistingContent = activeTorrents.length > 0 || activeTasks.length > 0 || completedFolders.length > 0 || completedFiles.length > 0;

    // If there is already an active download or free space is low (< 500MB), auto-queue directly!
    if (activeTorrents.length > 0 || activeTasks.length > 0 || (hasExistingContent && freeSpaceBytes < 500 * 1024 * 1024)) {
      console.log(`[Seedr] 📦 Seedr is currently occupied. Auto-enqueuing "${name || 'Torrent'}" into Upcoming Schedule...`);
      const queueItem = downloadQueue.addToQueue({ magnet, name, size });
      return res.json({
        autoQueued: true,
        message: 'Existing files/downloads in Seedr detected. Automatically scheduled in Upcoming Queue!',
        queueItem
      });
    }

    // 3. Attempt direct addition to Seedr
    const result = await seedrService.addMagnet(magnet);

    // 4. Handle Seedr response codes
    if (result) {
      if (result.result === 'file_too_big' || result.error === 'file_too_big') {
        return res.status(400).json({
          error: 'This file exceeds Seedr total 4.5 GB storage capacity limit.',
          isOversized: true
        });
      }

      if (result.result === 'not_enough_space' || result.result === 'free_user_limit' || result.result === false || result.result === 'user_torrent_limit') {
        console.log(`[Seedr] 📦 Seedr returned ${result.result}. Auto-enqueuing "${name || 'Torrent'}" into Upcoming Schedule...`);
        const queueItem = downloadQueue.addToQueue({ magnet, name, size });
        return res.json({
          autoQueued: true,
          message: 'Seedr storage is currently full. Automatically scheduled in Upcoming Queue!',
          queueItem
        });
      }
    }

    res.json(result);
  } catch (error) {
    const errorMsg = String(error.message || error.result || (error.response?.data?.result) || (error.response?.data?.error) || '');
    
    if (errorMsg.includes('file_too_big')) {
      return res.status(400).json({
        error: 'This file exceeds Seedr total 4.5 GB storage capacity limit.',
        isOversized: true
      });
    }

    if (errorMsg.includes('not_enough_space') || errorMsg.includes('free_user_limit') || errorMsg.includes('user_torrent_limit')) {
      const { magnet, name, size } = req.body;
      const queueItem = downloadQueue.addToQueue({ magnet, name, size });
      return res.json({
        autoQueued: true,
        message: 'Seedr storage is currently full. Automatically scheduled in Upcoming Queue!',
        queueItem
      });
    }

    res.status(500).json({ error: 'Failed to add magnet', details: error.message || error });
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
