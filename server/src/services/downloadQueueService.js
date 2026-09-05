const fs = require('fs');
const path = require('path');
const seedrService = require('./seedrService');
const magnetStorage = require('./magnetStorageService');

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
    this.dataDir = path.join(__dirname, '../../data');
    this.dataFile = path.join(this.dataDir, 'queue.json');
    this.queue = [];
    this.isAutoEnabled = true;
    this.isProcessing = false;
    this.checkInterval = 10000; // 10 seconds
    this.intervalHandle = null;

    this.loadData();
  }

  loadData() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.queue = Array.isArray(parsed.queue) ? parsed.queue : [];
        this.isAutoEnabled = parsed.isAutoEnabled !== undefined ? parsed.isAutoEnabled : true;
      } else {
        this.saveData();
      }
    } catch (e) {
      console.error('Error loading queue data:', e.message);
      this.queue = [];
    }
  }

  saveData() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(
        this.dataFile,
        JSON.stringify({
          queue: this.queue,
          isAutoEnabled: this.isAutoEnabled,
          updatedAt: new Date().toISOString()
        }, null, 2)
      );
    } catch (e) {
      console.error('Error saving queue data:', e.message);
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
      const folderData = await seedrService.listFolder();
      const activeTorrents = folderData.torrents || [];
      const activeTasks = folderData.tasks || [];
      const completedFolders = folderData.folders || [];
      const completedFiles = folderData.files || [];
      
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
        console.log(`[Queue] ⏳ Insufficient free storage in Seedr (${(freeSpace / (1024*1024)).toFixed(0)} MB free). Waiting for user to delete completed files.`);
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
      const result = await seedrService.addMagnet(nextItem.magnet);

      // 4. If Seedr rejects due to oversized file
      if (result && (result.result === 'file_too_big' || result.error === 'file_too_big')) {
        console.warn(`[Queue] ⚠️ Seedr rejected "${nextItem.name}" as oversized (> 4.5 GB). Auto-removing from queue.`);
        this.queue.shift();
        this.saveData();
        this.isProcessing = false;
        return;
      }

      // If Seedr still returns not_enough_space or free_user_limit, wait
      if (result && (result.result === 'not_enough_space' || result.result === 'free_user_limit' || result.result === false)) {
        console.log(`[Queue] ⏳ Seedr not ready for "${nextItem.name}". Keeping in queue.`);
        this.isProcessing = false;
        return;
      }

      // 5. Pop item from queue upon successful dispatch
      this.queue.shift();
      this.saveData();

      console.log(`[Queue] ✅ Successfully dispatched scheduled torrent "${nextItem.name}" to Seedr! (Remaining in queue: ${this.queue.length})`);

    } catch (error) {
      const errorMsg = String(error.message || error.result || '');
      if (errorMsg.includes('file_too_big')) {
        console.warn(`[Queue] ⚠️ Seedr rejected item as oversized (> 4.5 GB). Auto-removing.`);
        this.queue.shift();
        this.saveData();
      } else {
        console.error('[Queue] Error processing next scheduled item:', error.response ? error.response.data : error.message);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

module.exports = new DownloadQueueService();
