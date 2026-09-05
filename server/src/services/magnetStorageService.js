const fs = require('fs');
const path = require('path');

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days in milliseconds
const MAX_DELETED_ITEMS = 500;
const STORAGE_KEY = 'seedr_deleted_magnets';
const LEGACY_STORAGE_KEY = 'seedr_recent_magnets';
const LOCAL_FALLBACK_FILE = path.join(__dirname, '../../deleted_magnets_data.json');
const LEGACY_LOCAL_FALLBACK_FILE = path.join(__dirname, '../../recent_magnets_data.json');

class MagnetStorageService {
  constructor() {
    this.memoryFallback = [];
    this.url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
    this.token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;

    // Active magnet tracking registry to preserve original magnet links for deletion tracking
    this.activeMagnets = new Map(); // hash -> { magnet, hash, name, size, addedAt }
    this.idToHash = new Map(); // id (Seedr torrent/folder/file id) -> hash
    this.nameToHash = new Map(); // normalized name -> hash
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
      // Migrate from legacy file if it exists
      if (fs.existsSync(LEGACY_LOCAL_FALLBACK_FILE)) {
        const legacyData = fs.readFileSync(LEGACY_LOCAL_FALLBACK_FILE, 'utf8');
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
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
    const match = magnet.match(/[?&](?:dn|name|title)=([^&]+)/i);
    if (!match) return '';
    try {
      return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
    } catch (e) {
      return match[1].replace(/\+/g, ' ').trim();
    }
  }

  normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/[\s\.\-_]+/g, ' ');
  }

  // Register an added/active magnet so that we have its full magnet link when deleted
  registerActiveMagnet({ magnet, name, size, id, hash }) {
    if (!magnet && !hash) return;
    const resolvedHash = (hash || this.extractMagnetHash(magnet) || '').toLowerCase();
    const resolvedName = name || (magnet ? this.extractMagnetName(magnet) : '') || 'Torrent';
    const cleanMagnet = magnet || (resolvedHash ? `magnet:?xt=urn:btih:${resolvedHash}&dn=${encodeURIComponent(resolvedName)}` : '');

    const record = {
      magnet: cleanMagnet,
      hash: resolvedHash,
      name: resolvedName,
      size: size || null,
      addedAt: new Date().toISOString()
    };

    if (resolvedHash) {
      this.activeMagnets.set(resolvedHash, record);
    }
    if (id) {
      this.idToHash.set(String(id), resolvedHash);
    }
    if (resolvedName) {
      this.nameToHash.set(this.normalizeName(resolvedName), resolvedHash);
    }
    return record;
  }

  // Find a known magnet by ID, hash, or name
  findActiveMagnet({ id, hash, name }) {
    if (hash && this.activeMagnets.has(hash.toLowerCase())) {
      return this.activeMagnets.get(hash.toLowerCase());
    }
    if (id && this.idToHash.has(String(id))) {
      const h = this.idToHash.get(String(id));
      if (h && this.activeMagnets.has(h)) return this.activeMagnets.get(h);
    }
    if (name) {
      const norm = this.normalizeName(name);
      if (this.nameToHash.has(norm)) {
        const h = this.nameToHash.get(norm);
        if (h && this.activeMagnets.has(h)) return this.activeMagnets.get(h);
      }
    }
    return null;
  }

  // Helper to filter items for the past 30 days only
  filterPast30Days(list) {
    const cutoff = Date.now() - RETENTION_MS;
    return (Array.isArray(list) ? list : []).filter(item => {
      if (!item || (!item.magnet && !item.hash)) return false;

      // Filter out dummy test items
      const hash = item.hash || '';
      const magnet = item.magnet || '';
      if (/^hash\d+$/i.test(hash) || /xt=urn:btih:hash\d+/i.test(magnet)) {
        return false;
      }

      // Check deletion date within 30 days
      const delTime = item.deletedAt ? new Date(item.deletedAt).getTime() : 0;
      if (!delTime || isNaN(delTime)) {
        return false;
      }
      return delTime >= cutoff;
    });
  }

  // Retrieve deleted magnet links for the past 30 days
  async getDeletedMagnets() {
    let list = [];
    if (this.hasRemoteConfig()) {
      try {
        const raw = await this.executeKvCommand('GET', STORAGE_KEY);
        if (raw) {
          list = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } else {
          // Check legacy key
          const legacyRaw = await this.executeKvCommand('GET', LEGACY_STORAGE_KEY);
          if (legacyRaw) {
            list = typeof legacyRaw === 'string' ? JSON.parse(legacyRaw) : legacyRaw;
          }
        }
      } catch (err) {
        console.error('Failed to get deleted magnets from KV, using local fallback:', err.message);
        list = this.readLocalFallback();
      }
    } else {
      list = this.readLocalFallback();
    }

    // Filter strictly for past 30 days and sort newest deleted first
    const valid = this.filterPast30Days(list);
    valid.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    return valid;
  }

  // Save deleted magnets list
  async saveDeletedMagnets(list) {
    const valid = this.filterPast30Days(list);
    valid.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    const trimmed = valid.slice(0, MAX_DELETED_ITEMS);

    if (this.hasRemoteConfig()) {
      try {
        await this.executeKvCommand('SET', STORAGE_KEY, JSON.stringify(trimmed));
        return trimmed;
      } catch (err) {
        console.error('Failed to save deleted magnets to KV, using local fallback:', err.message);
      }
    }
    this.writeLocalFallback(trimmed);
    return trimmed;
  }

  // Record a deleted magnet link (past 30 days)
  async addDeletedMagnet(item) {
    if (!item) return await this.getDeletedMagnets();

    let magnet = (item.magnet || '').trim();
    let hash = (item.hash || this.extractMagnetHash(magnet) || '').toLowerCase();
    let title = item.title || item.name || this.extractMagnetName(magnet);
    let size = item.size || null;
    let addedAt = item.addedAt || null;

    // If magnet is missing or incomplete, search active magnets registry
    const known = this.findActiveMagnet({ id: item.id, hash, name: title });
    if (known) {
      if (!magnet) magnet = known.magnet;
      if (!hash) hash = known.hash;
      if (!title || title === 'Torrent') title = known.name;
      if (!size) size = known.size;
      if (!addedAt) addedAt = known.addedAt;
    }

    // If still no magnet, but hash is known, construct standard magnet URI
    if (!magnet && hash) {
      magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title || 'Torrent')}`;
    }

    if (!magnet && !hash) {
      console.warn('[MagnetStorage] Cannot record deleted magnet without magnet URI or infohash:', item);
      return await this.getDeletedMagnets();
    }

    const finalTitle = title || this.extractMagnetName(magnet) || 'Deleted Torrent';
    const deletedAt = item.deletedAt || new Date().toISOString();
    const reason = item.deletedReason || item.reason || 'Deleted from Seedr';

    const currentList = await this.getDeletedMagnets();

    // Deduplicate existing item with identical hash or URL
    const filtered = currentList.filter(entry => {
      if (hash && entry.hash) {
        return entry.hash.toLowerCase() !== hash.toLowerCase();
      }
      if (magnet && entry.magnet) {
        return entry.magnet.trim() !== magnet;
      }
      return true;
    });

    const newEntry = {
      id: hash || item.id || `del-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: finalTitle,
      title: finalTitle,
      magnet,
      hash,
      size,
      status: 'deleted',
      deletedAt,
      deletedReason: reason,
      addedAt
    };

    // Prepend new item and save
    const updated = [newEntry, ...filtered];
    const saved = await this.saveDeletedMagnets(updated);

    // Clean up from active registry
    if (hash) this.activeMagnets.delete(hash);

    console.log(`[MagnetStorage] 🗑️ Archived deleted magnet: "${finalTitle}" (${reason})`);
    return saved;
  }

  // Permanently remove a specific deleted magnet from history
  async removeDeletedMagnet(id) {
    if (!id) throw new Error('ID is required for removal');

    const currentList = await this.getDeletedMagnets();
    const filtered = currentList.filter(item => item.id !== id && item.hash !== id.toLowerCase());
    return await this.saveDeletedMagnets(filtered);
  }

  // Clear all deleted magnets history
  async clearDeletedMagnets() {
    return await this.saveDeletedMagnets([]);
  }

  // Backwards compatibility aliases
  async getRecentMagnets() {
    return await this.getDeletedMagnets();
  }

  async addRecentMagnet(item) {
    return await this.addDeletedMagnet(item);
  }

  async removeRecentMagnet(id) {
    return await this.removeDeletedMagnet(id);
  }

  async clearRecentMagnets() {
    return await this.clearDeletedMagnets();
  }
}

module.exports = new MagnetStorageService();
