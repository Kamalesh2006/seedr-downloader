const express = require('express');
const axios = require('axios');
const router = express.Router();
const seedrService = require('../services/seedrService');
const torrentWatchdog = require('../services/torrentWatchdogService');
const downloadQueue = require('../services/downloadQueueService');
const magnetStorage = require('../services/magnetStorageService');
const { seedrActionLimiter } = require('../middleware/rateLimiter');
const { validateMagnet, validateIdParam } = require('../middleware/validator');
const { sanitizeErrorMessage } = require('../middleware/errorHandler');
const vlcService = require('../utils/vlcService');

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
    const sizeInBytes = sizeInGB * 1024 * 1024 * 1024;

    // If there is already an active download or free space cannot fit this torrent:
    // Automatically schedule in Upcoming Queue!
    const notEnoughSpace = (sizeInBytes > 0 && freeSpaceBytes < sizeInBytes) || (hasExistingFiles && freeSpaceBytes < 600 * 1024 * 1024);

    if (hasActiveDownloads || notEnoughSpace) {
      const queueItem = downloadQueue.addToQueue({ magnet, name, size });
      return res.json({
        autoQueued: true,
        message: 'Insufficient free space in Seedr. Automatically scheduled in Upcoming Queue! (Will auto-start once space is freed)',
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

      if (
        result.result === 'not_enough_space' || 
        result.result === 'free_user_limit' || 
        result.result === false || 
        result.result === 'user_torrent_limit' ||
        result.reason_phrase?.includes('space') ||
        result.reason_phrase?.includes('wishlist')
      ) {
        const queueItem = downloadQueue.addToQueue({ magnet, name, size });
        return res.json({
          autoQueued: true,
          message: 'Seedr storage is currently full. Automatically scheduled in Upcoming Queue! (Will auto-start once space is freed)',
          queueItem
        });
      }
    }

    // Register magnet link in active registry for 30-day deletion tracking
    magnetStorage.registerActiveMagnet({ 
      magnet, 
      name: (result && result.title) || name, 
      size,
      id: (result && (result.user_torrent_id || result.id)) || null
    });

    res.json(result);
  } catch (error) {
    const rawReason = String(
      error?.reason_phrase || 
      error?.response?.data?.reason_phrase || 
      error?.error || 
      error?.response?.data?.error || 
      error?.message || 
      ''
    ).toLowerCase();

    const errorMsg = sanitizeErrorMessage(error);
    const combinedMsg = `${errorMsg} ${rawReason}`.toLowerCase();
    
    if (combinedMsg.includes('file_too_big')) {
      return res.status(400).json({
        error: 'This file exceeds Seedr total 4.5 GB storage capacity limit.',
        isOversized: true
      });
    }

    if (
      combinedMsg.includes('not_enough_space') || 
      combinedMsg.includes('free_user_limit') || 
      combinedMsg.includes('user_torrent_limit') || 
      combinedMsg.includes('wishlist') ||
      combinedMsg.includes('space') ||
      combinedMsg.includes('queue')
    ) {
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

    // Opportunistically check if queued items can now start in the cloud
    if (downloadQueue.queue.length > 0 && !downloadQueue.isProcessing && downloadQueue.isAutoEnabled) {
      downloadQueue.processNext().catch(() => {});
    }
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

// Comprehensive stream metadata endpoint (both direct download & HLS stream)
router.get('/stream-info/:fileId', validateIdParam('fileId'), async (req, res) => {
  try {
    const { fileId } = req.params;
    const info = await seedrService.getFileStreamInfo(fileId);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to get stream info' });
  }
});

// Helper function to resolve relative playlist URIs
function resolveM3u8Urls(content, baseUrl) {
  return content.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Handle URI attributes in tags like #EXT-X-MEDIA:...,URI="relative.m3u8"
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          return match;
        }
        try {
          return `URI="${new URL(uri, baseUrl).href}"`;
        } catch (e) {
          return match;
        }
      });
    }

    // Handle playlist / segment URLs on their own line
    if (!trimmed.startsWith('#')) {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return line;
      }
      try {
        return new URL(trimmed, baseUrl).href;
      } catch (e) {
        return line;
      }
    }

    return line;
  }).join('\n');
}

// Proxy HLS master playlist with CORS headers for in-browser playback
router.get('/hls-manifest', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    // Security: Only allow seedr.cc domains
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith('.seedr.cc') && parsedUrl.hostname !== 'seedr.cc') {
      return res.status(403).json({ error: 'Forbidden domain' });
    }

    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    let manifest = response.data;
    if (typeof manifest !== 'string') {
      manifest = String(manifest);
    }

    const resolvedManifest = resolveM3u8Urls(manifest, url);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(resolvedManifest);
  } catch (error) {
    console.error('Failed to proxy HLS manifest:', error.message);
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to fetch HLS manifest' });
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
    const bodyInfo = req.body || {};

    let fileInfo = {
      id: fileId,
      name: bodyInfo.name,
      size: bodyInfo.size,
      magnet: bodyInfo.magnet,
      hash: bodyInfo.hash
    };

    try {
      const folderData = await seedrService.listFolder();
      const match = (folderData.files || []).find(f => String(f.id) === String(fileId));
      if (match) {
        fileInfo.name = fileInfo.name || match.name;
        fileInfo.size = fileInfo.size || match.size;
      }
    } catch (e) {}

    const result = await seedrService.deleteFile(fileId);

    // Archive into 30-day deleted magnets
    await magnetStorage.addDeletedMagnet({
      id: fileId,
      name: fileInfo.name,
      size: fileInfo.size,
      hash: fileInfo.hash,
      magnet: fileInfo.magnet,
      deletedReason: 'Deleted file from Seedr'
    }).catch(err => console.error('Failed to archive deleted file:', err.message));

    // Wake up download queue processor immediately to auto-start queued files
    await downloadQueue.processNext().catch(err => console.warn('[Queue] Post-file-delete process error:', err.message));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete file' });
  }
});

router.delete('/folder/:folderId', validateIdParam('folderId'), async (req, res) => {
  try {
    const { folderId } = req.params;
    const bodyInfo = req.body || {};

    let folderInfo = {
      id: folderId,
      name: bodyInfo.name,
      size: bodyInfo.size,
      magnet: bodyInfo.magnet,
      hash: bodyInfo.hash
    };

    try {
      const folderData = await seedrService.listFolder();
      const match = (folderData.folders || []).find(f => String(f.id) === String(folderId));
      if (match) {
        folderInfo.name = folderInfo.name || match.name;
        folderInfo.size = folderInfo.size || match.size;
      }
    } catch (e) {}

    const result = await seedrService.deleteFolder(folderId);

    // Archive into 30-day deleted magnets
    await magnetStorage.addDeletedMagnet({
      id: folderId,
      name: folderInfo.name,
      size: folderInfo.size,
      hash: folderInfo.hash,
      magnet: folderInfo.magnet,
      deletedReason: 'Deleted folder from Seedr'
    }).catch(err => console.error('Failed to archive deleted folder:', err.message));

    // Wake up download queue processor immediately to auto-start queued files
    await downloadQueue.processNext().catch(err => console.warn('[Queue] Post-folder-delete process error:', err.message));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete folder' });
  }
});

router.delete('/torrent/:torrentId', validateIdParam('torrentId'), async (req, res) => {
  try {
    const { torrentId } = req.params;
    const bodyInfo = req.body || {};

    let torrentInfo = {
      id: torrentId,
      name: bodyInfo.name,
      magnet: bodyInfo.magnet,
      hash: bodyInfo.hash,
      size: bodyInfo.size
    };

    try {
      const folderData = await seedrService.listFolder();
      const match = (folderData.torrents || []).find(t => String(t.id) === String(torrentId));
      if (match) {
        torrentInfo.name = torrentInfo.name || match.name;
        torrentInfo.hash = torrentInfo.hash || match.hash;
        torrentInfo.size = torrentInfo.size || match.size;
      }
    } catch (e) {}

    const result = await seedrService.deleteTorrent(torrentId);

    // Archive into 30-day deleted magnets
    await magnetStorage.addDeletedMagnet({
      id: torrentId,
      name: torrentInfo.name,
      hash: torrentInfo.hash,
      magnet: torrentInfo.magnet,
      size: torrentInfo.size,
      deletedReason: 'Deleted active torrent from Seedr'
    }).catch(err => console.error('Failed to archive deleted torrent:', err.message));

    // Wake up download queue processor immediately to auto-start queued files
    await downloadQueue.processNext().catch(err => console.warn('[Queue] Post-torrent-delete process error:', err.message));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete torrent' });
  }
});

router.delete('/task/:taskId', validateIdParam('taskId'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await seedrService.deleteTask(taskId);
    await downloadQueue.processNext().catch(err => console.warn('[Queue] Post-task-delete process error:', err.message));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to delete task' });
  }
});

// Launch VLC media player directly on desktop
router.post('/open-vlc', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid stream URL is required' });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
    }

    await vlcService.launchVlcApp(url);
    res.json({ success: true, message: 'VLC app launched successfully' });
  } catch (error) {
    console.error('Failed to launch VLC app:', error.message);
    res.status(500).json({ error: sanitizeErrorMessage(error) || 'Failed to launch VLC player' });
  }
});

router.get('/watchdog', (req, res) => {
  res.json(torrentWatchdog.getStatus());
});

module.exports = router;

