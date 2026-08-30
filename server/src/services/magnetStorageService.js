const fs = require('fs');
const path = require('path');

const MAX_ITEMS = 10;
const STORAGE_KEY = 'seedr_recent_magnets';
const LOCAL_FALLBACK_FILE = path.join(__dirname, '../../recent_magnets_data.json');

class MagnetStorageService {
  constructor() {
    this.memoryFallback = [];
    this.url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
    this.token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;
  }

  // Check if remote KV config is available
  hasRemoteConfig() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || this.url;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || this.token;
    return !!(url && token);
  }

  // Execute Upstash / Vercel KV REST command
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

  // Helper to read from local file fallback
  readLocalFallback() {
    try {
      if (fs.existsSync(LOCAL_FALLBACK_FILE)) {
        const data = fs.readFileSync(LOCAL_FALLBACK_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.warn('Error reading local fallback file:', err.message);
    }
    return this.memoryFallback;
  }

  // Helper to write to local file fallback
  writeLocalFallback(data) {
    this.memoryFallback = data;
    try {
      fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      // In serverless / read-only filesystem environments, memoryFallback holds the state
    }
  }

  extractMagnetHash(magnet) {
    if (!magnet || typeof magnet !== 'string') return '';
    const match = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    return match ? match[1].toLowerCase() : '';
  }

  extractMagnetName(magnet) {
    if (!magnet || typeof magnet !== 'string') return '';
    const match = magnet.match(/dn=([^&]+)/i);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }

  async getRecentMagnets() {
    if (this.hasRemoteConfig()) {
      try {
        const raw = await this.executeKvCommand('GET', STORAGE_KEY);
        if (raw) {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
        return [];
      } catch (err) {
        console.error('Failed to get recent magnets from KV, using local fallback:', err.message);
      }
    }
    return this.readLocalFallback();
  }

  async saveRecentMagnets(list) {
    const trimmed = list.slice(0, MAX_ITEMS);
    if (this.hasRemoteConfig()) {
      try {
        await this.executeKvCommand('SET', STORAGE_KEY, JSON.stringify(trimmed));
        return trimmed;
      } catch (err) {
        console.error('Failed to save recent magnets to KV, using local fallback:', err.message);
      }
    }
    this.writeLocalFallback(trimmed);
    return trimmed;
  }

  async addRecentMagnet(item) {
    if (!item || !item.magnet) {
      throw new Error('Magnet URL is required');
    }

    const magnet = item.magnet.trim();
    const hash = item.hash || this.extractMagnetHash(magnet);
    const title = item.title || item.name || this.extractMagnetName(magnet) || 'Magnet Download';

    const currentList = await this.getRecentMagnets();

    // Deduplicate existing item with identical hash or URL
    const filtered = currentList.filter(entry => {
      if (hash && entry.hash) {
        return entry.hash.toLowerCase() !== hash.toLowerCase();
      }
      return entry.magnet.trim() !== magnet;
    });

    const newEntry = {
      id: item.id || hash || `mag-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: title,
      title: title,
      magnet,
      hash,
      size: item.size || null,
      status: item.status || 'queued',
      progress: item.progress || 0,
      files: item.files || [],
      addedAt: item.addedAt || new Date().toISOString()
    };

    // Prepend new item and keep maximum 10 items (FIFO sliding window)
    const updated = [newEntry, ...filtered].slice(0, MAX_ITEMS);
    return await this.saveRecentMagnets(updated);
  }

  async updateRecentMagnet(id, updates) {
    if (!id) throw new Error('ID is required for update');

    const currentList = await this.getRecentMagnets();
    let updatedAny = false;

    const updatedList = currentList.map(item => {
      if (item.id === id || (item.hash && item.hash.toLowerCase() === id.toLowerCase())) {
        updatedAny = true;
        return {
          ...item,
          ...updates,
          id: item.id // preserve id
        };
      }
      return item;
    });

    if (updatedAny) {
      return await this.saveRecentMagnets(updatedList);
    }

    return currentList;
  }

  async removeRecentMagnet(id) {
    if (!id) throw new Error('ID is required for removal');

    const currentList = await this.getRecentMagnets();
    const filtered = currentList.filter(item => item.id !== id && item.hash !== id);
    return await this.saveRecentMagnets(filtered);
  }

  async clearRecentMagnets() {
    return await this.saveRecentMagnets([]);
  }
}

module.exports = new MagnetStorageService();
