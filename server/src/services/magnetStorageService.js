const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days in milliseconds
const MAX_DELETED_ITEMS = 500;
const MAX_ACTIVE_ITEMS = 200;
const STORAGE_KEY = 'seedr_deleted_magnets';
const LEGACY_STORAGE_KEY = 'seedr_recent_magnets';
const ACTIVE_STORAGE_KEY = 'seedr_active_magnets';

class MagnetStorageService {
  constructor() {
    this.memoryFallback = [];
    this.url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
    this.token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;

    // Active magnet tracking registry to preserve original magnet links for deletion tracking
    this.activeMagnets = new Map(); // hash -> { magnet, hash, name, size, id, addedAt }
    this.idToHash = new Map(); // id (Seedr torrent/folder/file id) -> hash
    this.nameToHash = new Map(); // normalized name -> hash

    this.initPaths();
    this.loadActiveMagnets();
  }

  initPaths() {
    const isServerless = !!(
      process.env.VERCEL || 
      process.env.AWS_LAMBDA_FUNCTION_NAME || 
      process.env.LAMBDA_TASK_ROOT
    );

    if (isServerless) {
      this.dataDir = os.tmpdir();
    } else {
      const localDir = path.join(__dirname, '../../data');
      try {
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        this.dataDir = localDir;
      } catch (e) {
        this.dataDir = os.tmpdir();
      }
    }
    this.deletedFile = path.join(this.dataDir, 'deleted_magnets.json');
    this.activeFile = path.join(this.dataDir, 'active_magnets.json');
    this.legacyDeletedFile = path.join(__dirname, '../../deleted_magnets_data.json');
    this.legacyRecentFile = path.join(__dirname, '../../recent_magnets_data.json');
  }

  // Check if remote KV config is available
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

  // Execute Upstash / Vercel KV REST command
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

  // Helper to read from local file fallback for deleted magnets
  readLocalFallback() {
    try {
      if (fs.existsSync(this.deletedFile)) {
        const data = fs.readFileSync(this.deletedFile, 'utf8');
        return JSON.parse(data);
      }
      if (fs.existsSync(this.legacyDeletedFile)) {
        const legacyData = fs.readFileSync(this.legacyDeletedFile, 'utf8');
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      if (fs.existsSync(this.legacyRecentFile)) {
        const legacyData = fs.readFileSync(this.legacyRecentFile, 'utf8');
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const tmpFile = path.join(os.tmpdir(), 'seedr_deleted_magnets.json');
      if (fs.existsSync(tmpFile)) {
        const data = fs.readFileSync(tmpFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.warn('Error reading local fallback file:', err.message);
    }
    return this.memoryFallback;
  }

  // Helper to write to local file fallback for deleted magnets
  writeLocalFallback(data) {
    this.memoryFallback = data;
    try {
      fs.writeFileSync(this.deletedFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      try {
        const tmpFile = path.join(os.tmpdir(), 'seedr_deleted_magnets.json');
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
      } catch (tmpErr) {
        // memoryFallback holds state
      }
    }
  }

  // Load active magnets from disk
  loadActiveMagnets() {
    try {
      let activeList = [];
      if (fs.existsSync(this.activeFile)) {
        const raw = fs.readFileSync(this.activeFile, 'utf8');
        activeList = JSON.parse(raw);
      } else {
        const tmpFile = path.join(os.tmpdir(), 'seedr_active_magnets.json');
        if (fs.existsSync(tmpFile)) {
          const raw = fs.readFileSync(tmpFile, 'utf8');
          activeList = JSON.parse(raw);
        }
      }

      if (Array.isArray(activeList)) {
        for (const item of activeList) {
          if (!item) continue;
          const hash = (item.hash || '').toLowerCase();
          if (hash) {
            this.activeMagnets.set(hash, item);
          }
          if (item.id) {
            this.idToHash.set(String(item.id), hash);
          }
          if (item.name) {
            this.nameToHash.set(this.normalizeName(item.name), hash);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load active magnets from disk:', err.message);
    }
  }

  // Save active magnets to disk
  saveActiveMagnets() {
    try {
      const list = Array.from(this.activeMagnets.values()).slice(-MAX_ACTIVE_ITEMS);
      try {
        fs.writeFileSync(this.activeFile, JSON.stringify(list, null, 2), 'utf8');
      } catch (e) {
        const tmpFile = path.join(os.tmpdir(), 'seedr_active_magnets.json');
        fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), 'utf8');
      }
      // Also sync to remote KV if available
      if (this.hasRemoteConfig()) {
        this.executeKvCommand('SET', ACTIVE_STORAGE_KEY, JSON.stringify(list)).catch(() => {});
      }
    } catch (err) {
      console.warn('Failed to save active magnets to disk:', err.message);
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

  cleanSearchTokens(str) {
    if (!str || typeof str !== 'string') return [];
    const clean = str
      .toLowerCase()
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/www\.[a-z0-9\-_.]+/gi, ' ')
      .replace(/1tamilmv|tamilmv|tamilblasters|yts|tgx|rarbg|eztv|torrentgalaxy|psa|galaxytv/gi, ' ')
      .replace(/1080p|720p|2160p|4k|hevc|x264|x265|h264|h265|web-dl|webrip|bluray|hdrip|dvdrip|untouched|unrated|hq|avc|ddp5\.1|ddp5|dd5\.1|esub|complete|season|s\d{1,2}|e\d{1,2}/gi, ' ')
      .replace(/hindi|tamil|telugu|malayalam|kannada|english|dual audio|multi audio|clean/gi, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
    return clean.split(/\s+/).filter(t => t.length >= 2);
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
      id: id ? String(id) : null,
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

    this.saveActiveMagnets();
    return record;
  }

  // Find a known magnet by ID, hash, name, or token fuzzy match
  findActiveMagnet({ id, hash, name, size }) {
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

      // Token overlap & fuzzy matching across registered active magnets
      const targetTokens = this.cleanSearchTokens(name);
      if (targetTokens.length > 0) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [_, record] of this.activeMagnets.entries()) {
          const recordTokens = this.cleanSearchTokens(record.name);
          if (recordTokens.length === 0) continue;

          let matches = 0;
          for (const tok of targetTokens) {
            if (recordTokens.includes(tok)) matches++;
          }

          const overlapRatio = matches / Math.max(1, Math.min(targetTokens.length, recordTokens.length));
          let score = matches * 10 + overlapRatio * 20;

          // Bonus if sizes are close (within 10%)
          if (size && record.size && typeof size === 'number' && typeof record.size === 'number') {
            const sizeDiff = Math.abs(size - record.size) / Math.max(size, record.size);
            if (sizeDiff < 0.05) score += 30;
            else if (sizeDiff < 0.15) score += 15;
          }

          // Bonus if one string contains the other
          const normRecord = this.normalizeName(record.name);
          if (norm.includes(normRecord) || normRecord.includes(norm)) {
            score += 25;
          }

          if (score > bestScore && (matches >= 1 || score >= 20)) {
            bestScore = score;
            bestMatch = record;
          }
        }

        if (bestMatch && bestScore >= 20) {
          return bestMatch;
        }
      }
    }
    return null;
  }

  // Helper to filter items for the past 30 days only
  filterPast30Days(list) {
    const cutoff = Date.now() - RETENTION_MS;
    return (Array.isArray(list) ? list : []).filter(item => {
      if (!item) return false;
      if (!item.name && !item.title && !item.magnet && !item.hash) return false;

      // Filter out dummy test items
      const hash = item.hash || '';
      const magnet = item.magnet || '';
      if (/^hash\d+$/i.test(hash) || /xt=urn:btih:hash\d+/i.test(magnet)) {
        return false;
      }

      // Check date within past 30 days (support deletedAt, addedAt, timestamp, createdAt)
      const rawDate = item.deletedAt || item.addedAt || item.timestamp || item.createdAt || item.date;
      let delTime = rawDate ? new Date(rawDate).getTime() : Date.now();
      if (!delTime || isNaN(delTime)) {
        delTime = Date.now();
      }

      // Guarantee item has valid deletedAt ISO string
      if (!item.deletedAt) {
        item.deletedAt = new Date(delTime).toISOString();
      }

      return delTime >= cutoff;
    });
  }

  // Retrieve deleted magnet links for the past 30 days
  async getDeletedMagnets() {
    let list = [];
    let kvAvailable = false;

    if (this.hasRemoteConfig()) {
      try {
        const raw = await this.executeKvCommand('GET', STORAGE_KEY);
        if (raw) {
          list = typeof raw === 'string' ? JSON.parse(raw) : raw;
          kvAvailable = true;
        } else {
          // Check legacy key
          const legacyRaw = await this.executeKvCommand('GET', LEGACY_STORAGE_KEY);
          if (legacyRaw) {
            list = typeof legacyRaw === 'string' ? JSON.parse(legacyRaw) : legacyRaw;
            kvAvailable = true;
          }
        }
      } catch (err) {
        console.error('Failed to get deleted magnets from KV, using local fallback:', err.message);
      }
    }

    const localList = this.readLocalFallback();

    // Merge KV data with local fallback data to guarantee no loss
    const combinedMap = new Map();
    for (const item of (Array.isArray(list) ? list : [])) {
      if (!item) continue;
      const key = (item.hash || item.magnet || item.id || '').toLowerCase();
      if (key) combinedMap.set(key, item);
    }
    for (const item of (Array.isArray(localList) ? localList : [])) {
      if (!item) continue;
      const key = (item.hash || item.magnet || item.id || '').toLowerCase();
      if (key && !combinedMap.has(key)) combinedMap.set(key, item);
    }

    const mergedList = Array.from(combinedMap.values());
    const valid = this.filterPast30Days(mergedList);
    valid.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    // If local fallback had items that were missing in KV, sync them to KV
    if (kvAvailable && list.length < valid.length && this.hasRemoteConfig()) {
      this.executeKvCommand('SET', STORAGE_KEY, JSON.stringify(valid.slice(0, MAX_DELETED_ITEMS))).catch(() => {});
    }

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
      } catch (err) {
        console.error('Failed to save deleted magnets to KV, using local fallback:', err.message);
      }
    }
    this.writeLocalFallback(trimmed);
    return trimmed;
  }

  // Bi-directional synchronization of deleted magnets (e.g. from client local storage)
  async syncDeletedMagnets(externalList = []) {
    const currentList = await this.getDeletedMagnets();
    const itemMap = new Map();

    // Index current items
    for (const item of currentList) {
      const key = (item.hash || item.magnet || item.id || '').toLowerCase();
      if (key) itemMap.set(key, item);
    }

    // Merge external items
    for (const item of (Array.isArray(externalList) ? externalList : [])) {
      if (!item) continue;
      const key = (item.hash || item.magnet || item.id || '').toLowerCase();
      if (key) {
        const existing = itemMap.get(key);
        if (!existing) {
          itemMap.set(key, {
            ...item,
            deletedAt: item.deletedAt || item.addedAt || new Date().toISOString()
          });
        }
      }
    }

    const merged = Array.from(itemMap.values());
    return await this.saveDeletedMagnets(merged);
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
    const known = this.findActiveMagnet({ id: item.id, hash, name: title, size });
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

    // Fallback: If still no hash and no magnet, generate deterministic hash from title/id
    if (!magnet && !hash) {
      const pseudoHash = crypto.createHash('sha1').update((title || '') + String(item.id || Date.now())).digest('hex');
      hash = pseudoHash;
      magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title || 'Deleted Torrent')}`;
    }

    const finalTitle = title || this.extractMagnetName(magnet) || 'Deleted Torrent';
    const deletedAt = item.deletedAt || new Date().toISOString();
    const reason = item.deletedReason || item.reason || 'Deleted from Seedr';

    const currentList = await this.getDeletedMagnets();

    // Deduplicate existing item with identical hash, URL, or id
    const filtered = currentList.filter(entry => {
      if (hash && entry.hash) {
        return entry.hash.toLowerCase() !== hash.toLowerCase();
      }
      if (magnet && entry.magnet) {
        return entry.magnet.trim() !== magnet;
      }
      if (item.id && entry.id) {
        return String(entry.id) !== String(item.id);
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
    if (hash) {
      this.activeMagnets.delete(hash);
      this.saveActiveMagnets();
    }

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

  async syncRecentMagnets(list) {
    return await this.syncDeletedMagnets(list);
  }
}

module.exports = new MagnetStorageService();

