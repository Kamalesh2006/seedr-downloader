const fs = require('fs');
const path = require('path');
const seedrService = require('./seedrService');

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

    // Trigger check immediately in background
    setTimeout(() => this.processNext(), 1000);

    return newItem;
  }

  removeFromQueue(id) {
    const prevCount = this.queue.length;
    this.queue = this.queue.filter(item => item.id !== id);
    if (this.queue.length !== prevCount) {
      this.saveData();
      console.log(`[Queue] 🗑️ Removed item ${id} from upcoming schedule.`);
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
      
      const spaceUsed = folderData.space_used || 0;
      const spaceMax = folderData.space_max || (4.5 * 1024 * 1024 * 1024);
      const freeSpace = Math.max(0, spaceMax - spaceUsed);

      // If there is already an active downloading torrent in Seedr, wait for it to finish or be deleted
      if (activeTorrents.length > 0 || activeTasks.length > 0) {
        this.isProcessing = false;
        return;
      }

      // 2. Pick next queued item in order (FIFO)
      const nextItem = this.queue[0];
      if (!nextItem) {
        this.isProcessing = false;
        return;
      }

      // Check if we have at least 500MB free space (or if Seedr is completely empty)
      if (spaceUsed > 0 && freeSpace < 500 * 1024 * 1024) {
        console.log(`[Queue] ⏳ Insufficient free storage for next scheduled item (${(freeSpace / (1024*1024)).toFixed(0)} MB free). Waiting for storage to be freed.`);
        this.isProcessing = false;
        return;
      }

      console.log(`[Queue] 🚀 Auto-Scheduler submitting next item in order: "${nextItem.name}"...`);

      // 3. Submit magnet link to Seedr
      const result = await seedrService.addMagnet(nextItem.magnet);

      // 4. Pop item from queue upon successful submission
      this.queue.shift();
      this.saveData();

      console.log(`[Queue] ✅ Successfully dispatched scheduled torrent "${nextItem.name}" to Seedr! (Remaining in queue: ${this.queue.length})`);

    } catch (error) {
      console.error('[Queue] Error processing next scheduled item:', error.response ? error.response.data : error.message);
    } finally {
      this.isProcessing = false;
    }
  }
}

module.exports = new DownloadQueueService();
