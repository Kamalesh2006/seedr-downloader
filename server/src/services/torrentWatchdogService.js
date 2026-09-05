const seedrService = require('./seedrService');
const magnetStorage = require('./magnetStorageService');
const config = require('../../config.json');

class TorrentWatchdogService {
  constructor() {
    // 2 minutes stall timeout (no progress change)
    this.stalledTimeoutMs = (config.stalledTimeoutMinutes || 2) * 60 * 1000;
    // 1 hour maximum download timeout
    this.maxDownloadTimeoutMs = (config.maxDownloadTimeoutHours || 1) * 60 * 60 * 1000;
    // Maximum account capacity (4.5 GB)
    this.maxAccountSizeBytes = 4.5 * 1024 * 1024 * 1024;
    // Check interval (10 seconds)
    this.checkIntervalMs = 10000;
    
    // Map of torrentId -> { id, name, size, firstSeenAt, lastProgress, lastProgressChangedAt }
    this.trackedTorrents = new Map();
    // History of auto-cleaned torrents (max 20)
    this.cleanedHistory = [];
    this.intervalHandle = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`🛡️  Torrent Watchdog started: Auto-deleting stalled torrents (2m no progress), max download time (1h), and oversized torrents (> 4.5GB).`);

    // Run first check after 3 seconds, then periodically
    setTimeout(() => this.checkTorrents(), 3000);
    this.intervalHandle = setInterval(() => this.checkTorrents(), this.checkIntervalMs);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
  }

  async checkTorrents() {
    try {
      const folderData = await seedrService.listFolder();
      const activeTorrents = folderData.torrents || [];
      const currentIds = new Set(activeTorrents.map(t => String(t.id)));
      const now = Date.now();

      // Remove untracked / finished torrents from tracker
      for (const [id] of this.trackedTorrents.entries()) {
        if (!currentIds.has(String(id))) {
          this.trackedTorrents.delete(id);
        }
      }

      // Process each active torrent
      for (const torrent of activeTorrents) {
        const id = String(torrent.id);
        const name = torrent.name || 'Torrent Transfer';
        const progress = typeof torrent.progress === 'number' ? torrent.progress : 0;
        const size = torrent.size || 0;

        // Rule 0: Oversized torrent (> 4.5 GB) - Auto remove immediately
        if (size > this.maxAccountSizeBytes) {
          console.warn(`[Watchdog] ⚠️ Auto-deleting oversized torrent "${name}" (${(size / (1024*1024*1024)).toFixed(2)} GB > 4.5 GB limit).`);
          await this.autoDeleteTorrent(id, name, size, `File size (${(size / (1024*1024*1024)).toFixed(2)} GB) exceeds Seedr 4.5 GB account limit`);
          continue;
        }

        let tracked = this.trackedTorrents.get(id);

        if (!tracked) {
          // First time seeing this active torrent
          tracked = {
            id,
            name,
            hash: torrent.hash || '',
            size,
            firstSeenAt: now,
            lastProgress: progress,
            lastProgressChangedAt: now
          };
          this.trackedTorrents.set(id, tracked);
          console.log(`[Watchdog] ⏳ Tracking active torrent "${name}" (ID: ${id}) at ${progress}% progress.`);
          continue;
        }

        // Check if progress has changed
        if (progress !== tracked.lastProgress) {
          tracked.lastProgress = progress;
          tracked.lastProgressChangedAt = now;
          tracked.name = name;
        }

        const stalledDurationMs = now - tracked.lastProgressChangedAt;
        const totalDurationMs = now - tracked.firstSeenAt;

        // Rule 1: Stalled for 2 minutes (no progress change and not finished)
        if (progress < 100 && stalledDurationMs >= this.stalledTimeoutMs) {
          console.warn(`[Watchdog] ⚠️ Auto-deleting stalled torrent "${name}" (ID: ${id}) — no progress for ${(stalledDurationMs / 1000).toFixed(0)}s.`);
          await this.autoDeleteTorrent(id, name, size, `No progress for 2 minutes (stalled at ${progress}%)`);
          continue;
        }

        // Rule 2: Exceeded maximum 1 hour download duration
        if (progress < 100 && totalDurationMs >= this.maxDownloadTimeoutMs) {
          console.warn(`[Watchdog] ⚠️ Auto-deleting long-running torrent "${name}" (ID: ${id}) — exceeded 1 hour limit (${(totalDurationMs / 60000).toFixed(1)} mins).`);
          await this.autoDeleteTorrent(id, name, size, 'Exceeded 1 hour maximum download limit');
          continue;
        }
      }
    } catch (err) {
      // Ignore routine network blips during polling
    }
  }

  async autoDeleteTorrent(torrentId, name, size, reason) {
    try {
      const tracked = this.trackedTorrents.get(String(torrentId));
      const hash = (tracked && tracked.hash) || '';

      await seedrService.deleteTorrent(torrentId);
      this.trackedTorrents.delete(String(torrentId));
      
      const record = {
        id: torrentId,
        name,
        size,
        hash,
        reason,
        deletedAt: new Date().toISOString()
      };

      this.cleanedHistory = [record, ...this.cleanedHistory].slice(0, 20);
      console.log(`[Watchdog] ✅ Successfully cleaned up torrent "${name}" from Seedr storage (${reason}).`);

      // Archive into 30-day deleted magnet storage
      await magnetStorage.addDeletedMagnet({
        id: torrentId,
        name,
        size,
        hash,
        deletedReason: `Watchdog auto-delete: ${reason}`
      }).catch(err => console.error('[Watchdog] Failed to archive deleted magnet:', err.message));

      // Notify download queue to immediately process the next scheduled item
      try {
        const downloadQueue = require('./downloadQueueService');
        setTimeout(() => downloadQueue.processNext(), 2000);
      } catch (e) {}

    } catch (err) {
      console.error(`[Watchdog] Failed to auto-delete torrent ${torrentId}:`, err.message);
    }
  }

  getStatus() {
    const now = Date.now();
    const active = Array.from(this.trackedTorrents.values()).map(t => {
      const stalledForSeconds = Math.floor((now - t.lastProgressChangedAt) / 1000);
      const totalSeconds = Math.floor((now - t.firstSeenAt) / 1000);
      const stallRemainingSeconds = Math.max(0, Math.floor(this.stalledTimeoutMs / 1000) - stalledForSeconds);
      const maxRemainingSeconds = Math.max(0, Math.floor(this.maxDownloadTimeoutMs / 1000) - totalSeconds);

      return {
        ...t,
        stalledForSeconds,
        totalSeconds,
        stallRemainingSeconds,
        maxRemainingSeconds
      };
    });

    return {
      isRunning: this.isRunning,
      stalledTimeoutSeconds: this.stalledTimeoutMs / 1000,
      maxDownloadTimeoutSeconds: this.maxDownloadTimeoutMs / 1000,
      activeTrackedTorrents: active,
      cleanedHistory: this.cleanedHistory
    };
  }
}

module.exports = new TorrentWatchdogService();
