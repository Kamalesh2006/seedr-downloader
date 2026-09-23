const fs = require('fs');
const path = require('path');
const os = require('os');
const seedrService = require('./seedrService');
const magnetStorage = require('./magnetStorageService');
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

class DownloadQueueService {
  constructor() {
    this.initPaths();
    this.queue = [];
    this.isAutoEnabled = true;
    this.isProcessing = false;
    this.checkInterval = 10000; // 10 seconds
    this.intervalHandle = null;

    this.url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
    this.token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;

    this.loadData();
  }

  initPaths() {
    const isServerless = !!(
      process.env.VERCEL || 
      process.env.AWS_LAMBDA_FUNCTION_NAME || 
      process.env.LAMBDA_TASK_ROOT
    );

    if (isServerless) {
      this.dataDir = os.tmpdir();
      this.dataFile = path.join(this.dataDir, 'seedr_queue.json');
    } else {
      const localDir = path.join(__dirname, '../../data');
      try {
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        this.dataDir = localDir;
        this.dataFile = path.join(this.dataDir, 'queue.json');
      } catch (e) {
        this.dataDir = os.tmpdir();
        this.dataFile = path.join(this.dataDir, 'seedr_queue.json');
      }
    }
  }

  hasRemoteConfig() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || this.url;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || this.token;
    return !!(url && token);
  }

  getRemoteConfig() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || this.url;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || this.token;
    return { url, token };
  }

  async executeKvCommand(...command) {
    const { url, token } = this.getRemoteConfig();

    if (!url || !token) {
      throw new Error('KV credentials not configured');
    }

    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`KV REST Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.result;
  }

  async syncFromKv() {
    if (!this.hasRemoteConfig()) return;
    try {
      const remoteData = await this.executeKvCommand('GET', 'seedr_download_queue');
      if (remoteData) {
        const parsed = typeof remoteData === 'string' ? JSON.parse(remoteData) : remoteData;
        if (Array.isArray(parsed.queue)) {
          // If server currently has 0 items but KV has items, load them
          if (this.queue.length === 0) {
            this.queue = parsed.queue;
          } else {
            // Merge by ID or magnet
            const map = new Map();
            for (const it of parsed.queue) {
              const k = (it.id || it.magnet || '').toLowerCase();
              if (k) map.set(k, it);
            }
            for (const it of this.queue) {
              const k = (it.id || it.magnet || '').toLowerCase();
              if (k) map.set(k, it);
            }
            this.queue = Array.from(map.values());
          }
        }
        if (parsed.isAutoEnabled !== undefined) {
          this.isAutoEnabled = parsed.isAutoEnabled;
        }
      }
    } catch (e) {
      // Ignore KV sync errors silently
    }
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.queue = Array.isArray(parsed.queue) ? parsed.queue : [];
        this.isAutoEnabled = parsed.isAutoEnabled !== undefined ? parsed.isAutoEnabled : true;
      } else {
        const tmpFile = path.join(os.tmpdir(), 'seedr_queue.json');
        if (fs.existsSync(tmpFile)) {
          const raw = fs.readFileSync(tmpFile, 'utf8');
          const parsed = JSON.parse(raw);
          this.queue = Array.isArray(parsed.queue) ? parsed.queue : [];
          this.isAutoEnabled = parsed.isAutoEnabled !== undefined ? parsed.isAutoEnabled : true;
        }
      }
    } catch (e) {
      this.queue = [];
    }

    if (this.hasRemoteConfig()) {
      this.syncFromKv().catch(() => {});
    }
  }

  saveData() {
    const payload = {
      queue: this.queue,
      isAutoEnabled: this.isAutoEnabled,
      updatedAt: new Date().toISOString()
    };

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.dataFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
      try {
        const tmpFile = path.join(os.tmpdir(), 'seedr_queue.json');
        if (this.dataFile !== tmpFile) {
          this.dataDir = os.tmpdir();
          this.dataFile = tmpFile;
          fs.writeFileSync(this.dataFile, JSON.stringify(payload, null, 2), 'utf8');
        }
      } catch (tmpErr) {
        // Suppress disk write error in serverless, in-memory state holds data
      }
    }

    if (this.hasRemoteConfig()) {
      this.executeKvCommand('SET', 'seedr_download_queue', JSON.stringify(payload)).catch(() => {});
    }
  }

  start() {
    if (this.intervalHandle) return;
    console.log('📋 Download Queue Scheduler started: Automated order-wise processing active.');
    
    // Initial check
    setTimeout(() => this.processNext(), 4000);
    this.intervalHandle = setInterval(() => this.processNext(), this.checkInterval);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getQueueStatus() {
    return {
      isAutoEnabled: this.isAutoEnabled,
      isProcessing: this.isProcessing,
      totalQueued: this.queue.length,
      queue: this.queue
    };
  }

  addToQueue({ magnet, name, size }) {
    if (!magnet) throw new Error('Magnet link is required');

    // Reject files larger than 4.5 GB
    const sizeInGB = parseSizeInGB(size);
    if (sizeInGB > 4.5) {
      throw new Error(`File size (${size || sizeInGB.toFixed(2) + ' GB'}) exceeds Seedr's 4.5 GB maximum storage limit.`);
    }

    const id = `q-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newItem = {
      id,
      name: name || 'Scheduled Torrent',
      magnet: magnet.trim(),
      size: size || null,
      addedAt: new Date().toISOString(),
      status: 'queued'
    };

    this.queue.push(newItem);
    this.saveData();
    console.log(`[Queue] ➕ Added "${newItem.name}" to upcoming schedule (Position #${this.queue.length}).`);

    // Register into active magnets registry
    magnetStorage.registerActiveMagnet({
      magnet: newItem.magnet,
      name: newItem.name,
      size: newItem.size,
      id: newItem.id
    });

    // Trigger check in background
    setTimeout(() => this.processNext(), 1000);

    return newItem;
  }

  extractMagnetHash(magnet) {
    if (!magnet || typeof magnet !== 'string') return '';
    const match = magnet.match(/[?&]xt=urn:btih:([a-zA-Z0-9]+)/i);
    return match ? match[1].toLowerCase() : '';
  }

  normalizeTitle(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().toLowerCase().replace(/[\s\.\-_\[\]\(\)\+]+/g, ' ');
  }

  cleanTitleTokens(str) {
    if (!str || typeof str !== 'string') return [];
    const clean = str
      .toLowerCase()
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/www\.[a-z0-9\-_.]+/gi, ' ')
      .replace(/1tamilmv|tamilmv|tamilblasters|yts|tgx|rarbg|eztv|torrentgalaxy|psa|galaxytv/gi, ' ')
      .replace(/1080p|720p|2160p|4k|hevc|x264|x265|h264|h265|web-dl|webrip|bluray|hdrip|dvdrip|untouched|unrated|hq|avc|ddp5\.1|ddp5|dd5\.1|esub|complete/gi, ' ')
      .replace(/hindi|tamil|telugu|malayalam|kannada|english|dual audio|multi audio|clean/gi, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
    return clean.split(/\s+/).filter(t => t.length >= 2);
  }

  isItemInCloud(queueItem, folderData) {
    if (!queueItem || !folderData) return false;
    const qHash = this.extractMagnetHash(queueItem.magnet);
    const qName = queueItem.name || '';
    const normQ = this.normalizeTitle(qName);
    const qTokens = this.cleanTitleTokens(qName);

    const activeTorrents = folderData.torrents || [];
    const activeTasks = folderData.tasks || [];
    const completedFolders = folderData.folders || [];
    const completedFiles = folderData.files || [];

    // 1. Check active downloading torrents
    for (const t of activeTorrents) {
      const tHash = (t.torrent_hash || t.hash || '').toLowerCase();
      if (qHash && tHash && qHash === tHash) return true;
      const normT = this.normalizeTitle(t.name || t.title || '');
      if (normQ && normT && normQ === normT) return true;
    }

    // 2. Check active tasks
    for (const task of activeTasks) {
      const normTask = this.normalizeTitle(task.name || task.title || '');
      if (normQ && normTask && normQ === normTask) return true;
    }

    // 3. Check completed folders and files
    const allCloudItems = [...completedFolders, ...completedFiles];
    for (const f of allCloudItems) {
      const fName = f.name || f.path || f.title || '';
      const normF = this.normalizeTitle(fName);

      // Exact normalized title match
      if (normQ && normF && normQ === normF) return true;

      // Long substring match
      if (normQ.length >= 15 && normF.length >= 15) {
        if (normQ.includes(normF) || normF.includes(normQ)) return true;
      }

      // Content token overlap match
      if (qTokens.length >= 2) {
        const fTokens = this.cleanTitleTokens(fName);
        if (fTokens.length >= 2) {
          let matches = 0;
          for (const tok of qTokens) {
            if (fTokens.includes(tok)) matches++;
          }
          const overlap = matches / Math.min(qTokens.length, fTokens.length);
          if (overlap >= 0.8 && matches >= 2) return true;
        }
      }
    }

    // 4. Check active magnet registry
    if (qHash && magnetStorage.findActiveMagnet) {
      const activeRec = magnetStorage.findActiveMagnet({ hash: qHash, name: qName });
      if (activeRec && activeRec.id) {
        const existsInCloud = allCloudItems.some(f => String(f.id) === String(activeRec.id)) ||
                              activeTorrents.some(t => String(t.id) === String(activeRec.id));
        if (existsInCloud) return true;
      }
    }

    return false;
  }

  reconcileWithCloud(folderData) {
    if (!folderData || !Array.isArray(this.queue) || this.queue.length === 0) {
      return { removed: 0, queue: this.queue };
    }

    const initialCount = this.queue.length;
    const purged = [];
    this.queue = this.queue.filter(item => {
      if (this.isItemInCloud(item, folderData)) {
        purged.push(item);
        return false;
      }
      return true;
    });

    if (this.queue.length !== initialCount) {
      this.saveData();
      for (const p of purged) {
        console.log(`[Queue] 🎯 Cleared "${p.name}" from Upcoming Queue (already exists in Cloud Storage).`);
      }
    }

    return { removed: purged.length, queue: this.queue };
  }

  removeByMagnetOrHash(magnetOrHash, name = '') {
    if (!magnetOrHash && !name) return false;
    const targetHash = this.extractMagnetHash(magnetOrHash);
    const targetMagnet = (magnetOrHash || '').trim().toLowerCase();
    const normName = this.normalizeTitle(name);

    const prevCount = this.queue.length;
    this.queue = this.queue.filter(item => {
      if (targetHash && this.extractMagnetHash(item.magnet) === targetHash) return false;
      if (targetMagnet && item.magnet.toLowerCase() === targetMagnet) return false;
      if (normName && this.normalizeTitle(item.name) === normName) return false;
      return true;
    });

    if (this.queue.length !== prevCount) {
      this.saveData();
      console.log(`[Queue] 🗑️ Removed magnet from upcoming queue (${prevCount - this.queue.length} item(s)).`);
      return true;
    }
    return false;
  }

  removeFromQueue(id) {
    const itemToRemove = this.queue.find(item => item.id === id);
    const prevCount = this.queue.length;
    this.queue = this.queue.filter(item => item.id !== id);
    if (this.queue.length !== prevCount) {
      this.saveData();
      console.log(`[Queue] 🗑️ Removed item ${id} from upcoming schedule.`);

      if (itemToRemove) {
        magnetStorage.addDeletedMagnet({
          id: itemToRemove.id,
          name: itemToRemove.name,
          magnet: itemToRemove.magnet,
          size: itemToRemove.size,
          deletedReason: 'Removed from Upcoming Queue'
        }).catch(err => console.error('[Queue] Failed to archive removed queue magnet:', err.message));
      }
    }
    return { success: true, remaining: this.queue.length };
  }

  moveItem(id, direction) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) return { success: false, error: 'Item not found' };

    if (direction === 'up' && index > 0) {
      const temp = this.queue[index];
      this.queue[index] = this.queue[index - 1];
      this.queue[index - 1] = temp;
      this.saveData();
    } else if (direction === 'down' && index < this.queue.length - 1) {
      const temp = this.queue[index];
      this.queue[index] = this.queue[index + 1];
      this.queue[index + 1] = temp;
      this.saveData();
    }

    return { success: true, queue: this.queue };
  }

  reorderQueue(orderedIds = []) {
    if (!Array.isArray(orderedIds)) return { success: false };

    const itemMap = new Map(this.queue.map(item => [item.id, item]));
    const reordered = [];

    for (const id of orderedIds) {
      if (itemMap.has(id)) {
        reordered.push(itemMap.get(id));
        itemMap.delete(id);
      }
    }

    // Append any remaining items
    for (const remaining of itemMap.values()) {
      reordered.push(remaining);
    }

    this.queue = reordered;
    this.saveData();
    return { success: true, queue: this.queue };
  }

  clearQueue() {
    this.queue = [];
    this.saveData();
    return { success: true, message: 'Queue cleared' };
  }

  toggleAutoProcessor(enabled) {
    this.isAutoEnabled = enabled !== undefined ? !!enabled : !this.isAutoEnabled;
    this.saveData();
    if (this.isAutoEnabled) {
      setTimeout(() => this.processNext(), 1000);
    }
    return { success: true, isAutoEnabled: this.isAutoEnabled };
  }

  syncQueue(externalQueue = []) {
    if (!Array.isArray(externalQueue) || externalQueue.length === 0) {
      return { success: true, queue: this.queue };
    }
    const itemMap = new Map();
    // Prioritize existing items on server
    for (const item of this.queue) {
      const key = (item.magnet || item.id || '').toLowerCase();
      if (key) itemMap.set(key, item);
    }
    // Add items from external queue
    for (const item of externalQueue) {
      const key = (item.magnet || item.id || '').toLowerCase();
      if (key && !itemMap.has(key)) {
        itemMap.set(key, item);
      }
    }
    this.queue = Array.from(itemMap.values());
    this.saveData();
    return { success: true, queue: this.queue };
  }

  async processNext() {
    if (!this.isAutoEnabled || this.isProcessing) {
      return;
    }

    if (this.hasRemoteConfig()) {
      await this.syncFromKv().catch(() => {});
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // 1. Inspect Seedr current state
      let folderData;
      try {
        folderData = await seedrService.listFolder();
      } catch (listErr) {
        const safeListMsg = sanitizeErrorMessage(listErr);
        console.warn(`[Queue] ⚠️ Could not inspect Seedr storage state (${safeListMsg}). Will retry later.`);
        this.isProcessing = false;
        return;
      }

      // Reconcile queue with current cloud items immediately
      this.reconcileWithCloud(folderData);

      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      const activeTorrents = folderData.torrents || [];
      const spaceUsed = folderData.space_used || 0;
      const spaceMax = folderData.space_max || (4.5 * 1024 * 1024 * 1024);
      const freeSpace = Math.max(0, spaceMax - spaceUsed);

      // Only wait if there is a torrent actively downloading right now (< 100% progress and not stopped)
      const isActivelyDownloading = activeTorrents.some(t => !t.stopped && (t.progress === undefined || t.progress < 100));
      if (isActivelyDownloading) {
        this.isProcessing = false;
        return;
      }

      // If existing completed files occupy all storage (free space < 100MB), wait for user to delete files
      if (freeSpace < 100 * 1024 * 1024) {
        console.log(`[Queue] ⏳ Cloud storage full (${(freeSpace / (1024 * 1024)).toFixed(0)} MB free). Waiting for user to delete completed files.`);
        this.isProcessing = false;
        return;
      }

      // 2. Remove any oversized items (> 4.5 GB) from the queue
      const initialCount = this.queue.length;
      this.queue = this.queue.filter(item => {
        const sz = parseSizeInGB(item.size);
        if (sz > 4.5) {
          console.warn(`[Queue] ⚠️ Auto-removing oversized item "${item.name}" (${sz.toFixed(2)} GB > 4.5 GB limit) from queue.`);
          return false;
        }
        return true;
      });
      if (this.queue.length !== initialCount) {
        this.saveData();
      }

      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      // 3. Select the best eligible queued item (prefer FIFO order, but check fit against available free space)
      let candidateIndex = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];
        const itemSizeInGB = parseSizeInGB(item.size);
        const itemSizeInBytes = itemSizeInGB * 1024 * 1024 * 1024;

        if (itemSizeInBytes > 0) {
          // Check if item fits in available free space (with a 50MB safety buffer)
          if (itemSizeInBytes <= freeSpace) {
            candidateIndex = i;
            break;
          }
        } else {
          // If size is unknown, only attempt if there is at least 500 MB free space
          if (freeSpace >= 500 * 1024 * 1024) {
            candidateIndex = i;
            break;
          }
        }
      }

      // If no item fits in currently free storage, wait for user to free more storage
      if (candidateIndex === -1) {
        const firstItem = this.queue[0];
        const firstSize = parseSizeInGB(firstItem.size);
        console.log(`[Queue] ⏳ Insufficient free storage in Seedr (${(freeSpace / (1024 * 1024)).toFixed(0)} MB free). Next item "${firstItem.name}" needs ${firstSize > 0 ? (firstSize * 1024).toFixed(0) + ' MB' : 'more free space'}. Waiting for user to free cloud storage.`);
        this.isProcessing = false;
        return;
      }

      const nextItem = this.queue[candidateIndex];
      console.log(`[Queue] 🚀 Auto-Scheduler submitting eligible item: "${nextItem.name}" (Queue position #${candidateIndex + 1}/${this.queue.length})...`);

      // 4. Submit magnet link to Seedr
      let result;
      try {
        result = await seedrService.addMagnet(nextItem.magnet);
      } catch (apiError) {
        // Handle rejection or error thrown from Seedr API / Axios
        const safeMsg = sanitizeErrorMessage(apiError);
        const rawError = String(apiError?.error || apiError?.response?.data?.error || '');
        const rawResult = String(apiError?.result || apiError?.response?.data?.result || '');
        const rawReason = String(apiError?.reason_phrase || apiError?.response?.data?.reason_phrase || '');
        const rawMsg = String(apiError?.message || '');
        const combined = `${safeMsg} ${rawError} ${rawResult} ${rawReason} ${rawMsg}`.toLowerCase();

        if (combined.includes('file_too_big')) {
          console.warn(`[Queue] ⚠️ Seedr rejected "${nextItem.name}" as oversized (> 4.5 GB). Auto-removing from queue.`);
          this.queue.splice(candidateIndex, 1);
          this.saveData();
          this.isProcessing = false;
          return;
        }

        if (
          combined.includes('not_enough_space') ||
          combined.includes('free_user_limit') ||
          combined.includes('user_torrent_limit') ||
          combined.includes('wishlist') ||
          combined.includes('space') ||
          combined.includes('queue')
        ) {
          console.log(`[Queue] ⏳ Seedr not ready for "${nextItem.name}" (${safeMsg || 'Storage full / limits reached'}). Keeping in queue.`);
          this.isProcessing = false;
          return;
        }

        // Permanently unrecoverable magnet links (malformed hash, invalid protocol)
        if (
          combined.includes('invalid_magnet') ||
          combined.includes('invalid magnet') ||
          combined.includes('malformed') ||
          combined.includes('cant_fetch_torrent')
        ) {
          console.warn(`[Queue] ⚠️ Seedr rejected "${nextItem.name}" due to invalid magnet link (${safeMsg}). Removing from queue.`);
          this.queue.splice(candidateIndex, 1);
          this.saveData();
          this.isProcessing = false;
          return;
        }

        // Track consecutive failures - allow up to 10 attempts before flagging
        nextItem.attempts = (nextItem.attempts || 0) + 1;
        if (nextItem.attempts >= 10) {
          console.warn(`[Queue] ⚠️ Item "${nextItem.name}" failed 10 consecutive times (${safeMsg}). Removing from queue.`);
          this.queue.splice(candidateIndex, 1);
          this.saveData();
        } else {
          console.error('[Queue] Error processing scheduled item:', safeMsg || rawError || rawResult || rawMsg || 'Seedr request failed');
        }

        this.isProcessing = false;
        return;
      }

      // 5. Verify response from Seedr
      if (result) {
        if (result.result === 'file_too_big' || result.error === 'file_too_big') {
          console.warn(`[Queue] ⚠️ Seedr rejected "${nextItem.name}" as oversized (> 4.5 GB). Auto-removing from queue.`);
          this.queue.splice(candidateIndex, 1);
          this.saveData();
          this.isProcessing = false;
          return;
        }

        if (
          result.result === 'not_enough_space' ||
          result.result === 'free_user_limit' ||
          result.result === 'user_torrent_limit' ||
          result.result === false ||
          result.wt ||
          result.reason_phrase?.includes('space') ||
          result.reason_phrase?.includes('wishlist')
        ) {
          console.log(`[Queue] ⏳ Seedr storage limit reached for "${nextItem.name}". Keeping in queue.`);
          this.isProcessing = false;
          return;
        }

        // Validate confirmed success indicator from Seedr API
        const isConfirmedSuccess = !!(
          result.user_torrent_id || 
          result.id || 
          result.success === true || 
          result.torrent_hash ||
          (result.result === true)
        );

        if (isConfirmedSuccess) {
          // Register magnet with Seedr user_torrent_id and torrent_hash for deletion tracking
          magnetStorage.registerActiveMagnet({
            magnet: nextItem.magnet,
            name: (result && result.title) || nextItem.name,
            size: nextItem.size,
            id: (result && (result.user_torrent_id || result.id)) || null,
            hash: (result && result.torrent_hash) || null
          });

          // Successfully added to Seedr: Remove from queue
          this.queue.splice(candidateIndex, 1);
          this.saveData();
          console.log(`[Queue] ✅ Successfully dispatched scheduled torrent "${nextItem.name}" to Seedr! (Remaining in queue: ${this.queue.length})`);
        } else {
          console.warn(`[Queue] ⚠️ Unconfirmed dispatch result for "${nextItem.name}". Keeping in queue to prevent loss:`, result);
        }
      }

    } catch (unexpectedError) {
      const safeMsg = sanitizeErrorMessage(unexpectedError);
      console.error('[Queue] Unexpected error processing next scheduled item:', safeMsg || unexpectedError?.message || unexpectedError);
    } finally {
      this.isProcessing = false;
    }
  }
}

module.exports = new DownloadQueueService();
