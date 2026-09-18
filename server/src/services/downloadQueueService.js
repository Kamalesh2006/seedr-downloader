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

  async executeKvCommand(...command) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || this.url;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || this.token;

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
          this.queue = parsed.queue;
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

  async processNext() {
    if (!this.isAutoEnabled || this.isProcessing || this.queue.length === 0) {
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

      const activeTorrents = folderData.torrents || [];
      const activeTasks = folderData.tasks || [];
      const spaceUsed = folderData.space_used || 0;
      const spaceMax = folderData.space_max || (4.5 * 1024 * 1024 * 1024);
      const freeSpace = Math.max(0, spaceMax - spaceUsed);

      // If there is already an active downloading torrent or processing task, wait
      if (activeTorrents.length > 0 || activeTasks.length > 0) {
        this.isProcessing = false;
        return;
      }

      // If existing completed files occupy the majority of storage (free space < 500MB), wait for user to delete files
      if (spaceUsed > 0 && freeSpace < 500 * 1024 * 1024) {
        console.log(`[Queue] ⏳ Insufficient free storage in Seedr (${(freeSpace / (1024 * 1024)).toFixed(0)} MB free). Waiting for user to delete completed files.`);
        this.isProcessing = false;
        return;
      }

      // 2. Pick next queued item in order (FIFO)
      const nextItem = this.queue[0];
      if (!nextItem) {
        this.isProcessing = false;
        return;
      }

      // Check if next queued item is oversized (> 4.5 GB) -> auto-remove from queue
      const itemSizeInGB = parseSizeInGB(nextItem.size);
      if (itemSizeInGB > 4.5) {
        console.warn(`[Queue] ⚠️ Auto-removing oversized item "${nextItem.name}" (${itemSizeInGB.toFixed(2)} GB > 4.5 GB) from queue.`);
        this.queue.shift();
        this.saveData();
        this.isProcessing = false;
        return;
      }

      console.log(`[Queue] 🚀 Auto-Scheduler submitting next item in order: "${nextItem.name}"...`);

      // 3. Submit magnet link to Seedr
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
          this.queue.shift();
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
          this.queue.shift();
          this.saveData();
          this.isProcessing = false;
          return;
        }

        // Track consecutive failures to avoid blocking the queue permanently
        nextItem.attempts = (nextItem.attempts || 0) + 1;
        if (nextItem.attempts >= 3) {
          console.warn(`[Queue] ⚠️ Item "${nextItem.name}" failed 3 consecutive times (${safeMsg}). Removing from upcoming queue.`);
          this.queue.shift();
          this.saveData();
        } else {
          console.error('[Queue] Error processing next scheduled item:', safeMsg || rawError || rawResult || rawMsg || 'Seedr request failed');
        }

        this.isProcessing = false;
        return;
      }

      // 4. If Seedr returned 200 response with error payload
      if (result) {
        if (result.result === 'file_too_big' || result.error === 'file_too_big') {
          console.warn(`[Queue] ⚠️ Seedr rejected "${nextItem.name}" as oversized (> 4.5 GB). Auto-removing from queue.`);
          this.queue.shift();
          this.saveData();
          this.isProcessing = false;
          return;
        }

        if (
          result.result === 'not_enough_space' ||
          result.result === 'free_user_limit' ||
          result.result === 'user_torrent_limit' ||
          result.result === false ||
          result.reason_phrase?.includes('space') ||
          result.reason_phrase?.includes('wishlist')
        ) {
          console.log(`[Queue] ⏳ Seedr not ready for "${nextItem.name}". Keeping in queue.`);
          this.isProcessing = false;
          return;
        }
      }

      // 5. Pop item from queue upon successful dispatch
      this.queue.shift();
      this.saveData();

      console.log(`[Queue] ✅ Successfully dispatched scheduled torrent "${nextItem.name}" to Seedr! (Remaining in queue: ${this.queue.length})`);

    } catch (unexpectedError) {
      const safeMsg = sanitizeErrorMessage(unexpectedError);
      console.error('[Queue] Unexpected error processing next scheduled item:', safeMsg || unexpectedError?.message || unexpectedError);
    } finally {
      this.isProcessing = false;
    }
  }
}

module.exports = new DownloadQueueService();
