import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { extractMagnetName, extractMagnetHash } from '../utils/magnet';

const STORAGE_KEY = 'seedr_deleted_magnets_30d';
const ACTIVE_STORAGE_KEY = 'seedr_active_magnets';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generatePseudoHash(str) {
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }
  const hex1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return (hex1 + hex2 + hex1 + hex2 + hex1).slice(0, 40);
}

function cleanTokens(str) {
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

function findActiveMagnetInStorage({ id, name, size, hash }) {
  try {
    const raw = localStorage.getItem(ACTIVE_STORAGE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return null;

    if (hash) {
      const match = list.find(m => (m.hash || '').toLowerCase() === hash.toLowerCase());
      if (match) return match;
    }

    if (id) {
      const match = list.find(m => String(m.id) === String(id));
      if (match) return match;
    }

    if (name) {
      const normName = name.trim().toLowerCase().replace(/[\s\.\-_]+/g, ' ');
      const exactMatch = list.find(m => {
        const normM = (m.name || '').trim().toLowerCase().replace(/[\s\.\-_]+/g, ' ');
        return normM === normName;
      });
      if (exactMatch) return exactMatch;

      const targetTokens = cleanTokens(name);
      if (targetTokens.length > 0) {
        let bestItem = null;
        let bestScore = 0;

        for (const item of list) {
          const itemTokens = cleanTokens(item.name || '');
          if (itemTokens.length === 0) continue;

          let matches = 0;
          for (const tok of targetTokens) {
            if (itemTokens.includes(tok)) matches++;
          }

          const overlapRatio = matches / Math.max(1, Math.min(targetTokens.length, itemTokens.length));
          let score = matches * 10 + overlapRatio * 20;

          if (size && item.size && typeof size === 'number' && typeof item.size === 'number') {
            const sizeDiff = Math.abs(size - item.size) / Math.max(size, item.size);
            if (sizeDiff < 0.05) score += 30;
            else if (sizeDiff < 0.15) score += 15;
          }

          const normItem = (item.name || '').trim().toLowerCase().replace(/[\s\.\-_]+/g, ' ');
          if (normName.includes(normItem) || normItem.includes(normName)) {
            score += 25;
          }

          if (score > bestScore && (matches >= 1 || score >= 20)) {
            bestScore = score;
            bestItem = item;
          }
        }

        if (bestItem && bestScore >= 20) {
          return bestItem;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to search active magnets from localStorage', e);
  }
  return null;
}

function isDummyTestMagnet(item) {
  if (!item) return true;
  if (!item.name && !item.title && !item.magnet && !item.hash) return true;
  const magnet = item.magnet || '';
  const hash = item.hash || '';
  // Filter out dummy test items with fake hashes (e.g. hash12, hash11, etc.)
  if (/^hash\d+$/i.test(hash) || /xt=urn:btih:hash\d+/i.test(magnet)) {
    return true;
  }
  return false;
}

function isWithin30Days(item) {
  if (!item) return false;
  const raw = item.deletedAt || item.addedAt || item.timestamp || item.createdAt || item.date;
  const time = raw ? new Date(raw).getTime() : Date.now();
  if (isNaN(time)) return true;
  return Date.now() - time <= RETENTION_MS;
}

export default function useRecentMagnets() {
  const [deletedMagnets, setDeletedMagnets] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) 
        ? parsed.filter(item => !isDummyTestMagnet(item) && isWithin30Days(item))
        : [];
    } catch (e) {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);

  // Sync to local cache helper (filters 30 days automatically)
  const syncLocal = useCallback((items) => {
    try {
      const validItems = (items || []).filter(item => !isDummyTestMagnet(item) && isWithin30Days(item));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validItems));
    } catch (e) {
      console.error('Failed to sync to local cache', e);
    }
  }, []);

  // Register an active torrent/magnet so we retain its magnet link upon cloud deletion
  const registerActiveMagnet = useCallback(({ magnet, name, size, id, hash }) => {
    if (!magnet && !hash) return;
    const resolvedHash = (hash || (magnet ? extractMagnetHash(magnet) : '') || '').toLowerCase();
    const resolvedName = name || (magnet ? extractMagnetName(magnet) : '') || 'Torrent';
    const cleanMagnet = magnet || (resolvedHash ? `magnet:?xt=urn:btih:${resolvedHash}&dn=${encodeURIComponent(resolvedName)}` : '');

    const record = {
      id: id ? String(id) : null,
      name: resolvedName,
      hash: resolvedHash,
      magnet: cleanMagnet,
      size: size || null,
      addedAt: new Date().toISOString()
    };

    try {
      const raw = localStorage.getItem(ACTIVE_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const filtered = (Array.isArray(list) ? list : []).filter(item => {
        if (resolvedHash && item.hash) return item.hash.toLowerCase() !== resolvedHash;
        if (id && item.id) return String(item.id) !== String(id);
        return true;
      });
      const updated = [record, ...filtered].slice(0, 100);
      localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save active magnet in localStorage', e);
    }

    // Also register with server
    api.post('/magnets/recent', {
      action: 'register',
      magnet: cleanMagnet,
      name: resolvedName,
      size,
      id,
      hash: resolvedHash
    }).catch(() => {});

    return record;
  }, []);

  // Fetch 30-day deleted magnets from remote backend with safe non-destructive merge
  const fetchRemoteMagnets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/magnets/recent');
      if (res.data && Array.isArray(res.data.magnets)) {
        const remoteList = res.data.magnets.filter(item => !isDummyTestMagnet(item) && isWithin30Days(item));
        
        setDeletedMagnets(prev => {
          // SAFE MERGE: Index existing local items so they are NEVER wiped out
          const itemMap = new Map();
          for (const item of (Array.isArray(prev) ? prev : [])) {
            const key = (item.hash || item.magnet || item.id || '').toLowerCase();
            if (key) itemMap.set(key, item);
          }

          // Merge remote items
          for (const item of remoteList) {
            const key = (item.hash || item.magnet || item.id || '').toLowerCase();
            if (key) itemMap.set(key, item);
          }

          const merged = Array.from(itemMap.values()).filter(isWithin30Days);
          merged.sort((a, b) => {
            const timeA = new Date(a.deletedAt || a.addedAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.deletedAt || b.addedAt || b.timestamp || 0).getTime();
            return timeB - timeA;
          });

          syncLocal(merged);

          // If local items existed that the remote database was missing, sync them upstream
          if (remoteList.length < merged.length) {
            api.post('/magnets/sync', { magnets: merged }).catch(() => {});
          }

          return merged;
        });
      }
    } catch (err) {
      console.warn('Failed to load deleted magnets from remote server, using local cache:', err.message);
    } finally {
      setLoading(false);
    }
  }, [syncLocal]);

  useEffect(() => {
    fetchRemoteMagnets();
  }, [fetchRemoteMagnets]);

  // Record a deleted magnet link (past 30 days)
  const recordDeletedMagnet = useCallback(async (item) => {
    if (!item) return;

    let magnet = (item.magnet || '').trim();
    let hash = (item.hash || (magnet ? extractMagnetHash(magnet) : '') || '').toLowerCase();
    let name = (item.name && item.name.trim()) || (item.title && item.title.trim()) || (magnet ? extractMagnetName(magnet) : '') || 'Torrent';
    let size = item.size || null;
    let addedAt = item.addedAt || null;

    // If magnet is missing or incomplete, search active magnets registry
    const known = findActiveMagnetInStorage({ id: item.id, name, size, hash });
    if (known) {
      if (!magnet) magnet = known.magnet;
      if (!hash) hash = known.hash;
      if (!name || name === 'Torrent') name = known.name;
      if (!size) size = known.size;
      if (!addedAt) addedAt = known.addedAt;
    }

    // If still no magnet, but hash is known
    if (!magnet && hash) {
      magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name || 'Torrent')}`;
    }

    // Fallback: If still no hash and no magnet, generate deterministic hash from title/id
    if (!magnet && !hash) {
      const pseudoHash = generatePseudoHash((name || '') + String(item.id || Date.now()));
      hash = pseudoHash;
      magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name || 'Deleted Torrent')}`;
    }

    const newEntry = {
      id: hash || item.id || `del-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      title: name,
      magnet,
      hash,
      size,
      status: 'deleted',
      deletedAt: item.deletedAt || new Date().toISOString(),
      deletedReason: item.deletedReason || item.reason || 'Deleted from Seedr',
      addedAt
    };

    // Optimistic UI update
    setDeletedMagnets(prev => {
      const filtered = prev.filter(entry => {
        if (hash && entry.hash) {
          return entry.hash.toLowerCase() !== hash.toLowerCase();
        }
        if (magnet && entry.magnet) {
          return entry.magnet.trim() !== magnet;
        }
        if (item.id && entry.id) {
          return String(entry.id) !== String(item.id);
        }
        return entry.id !== newEntry.id;
      });
      const updated = [newEntry, ...filtered].filter(isWithin30Days);
      syncLocal(updated);
      return updated;
    });

    // Remote persistence
    try {
      const res = await api.post('/magnets/recent', newEntry);
      if (res.data && Array.isArray(res.data.magnets)) {
        const cleanList = res.data.magnets.filter(isWithin30Days);
        setDeletedMagnets(cleanList);
        syncLocal(cleanList);
      }
    } catch (err) {
      console.error('Failed to sync recorded deleted magnet to remote storage:', err);
    }
  }, [syncLocal]);

  // Permanently remove a specific deleted magnet from history
  const removeDeletedMagnet = useCallback(async (id) => {
    if (!id) return;

    // Optimistic UI update
    setDeletedMagnets(prev => {
      const updated = prev.filter(item => item.id !== id && item.hash !== id.toLowerCase());
      syncLocal(updated);
      return updated;
    });

    // Remote persistence
    try {
      const res = await api.delete(`/magnets/recent/${id}`);
      if (res.data && Array.isArray(res.data.magnets)) {
        const cleanList = res.data.magnets.filter(isWithin30Days);
        setDeletedMagnets(cleanList);
        syncLocal(cleanList);
      }
    } catch (err) {
      console.error('Failed to remove deleted magnet from remote storage:', err);
    }
  }, [syncLocal]);

  // Clear all deleted magnets history
  const clearDeletedMagnets = useCallback(async () => {
    setDeletedMagnets([]);
    syncLocal([]);
    try {
      const res = await api.delete('/magnets/recent');
      if (res.data && Array.isArray(res.data.magnets)) {
        setDeletedMagnets(res.data.magnets);
        syncLocal(res.data.magnets);
      }
    } catch (err) {
      console.error('Failed to clear deleted magnets on remote storage:', err);
    }
  }, [syncLocal]);

  return {
    recentMagnets: deletedMagnets,
    deletedMagnets,
    loading,
    recordDeletedMagnet,
    registerActiveMagnet,
    findActiveMagnet: findActiveMagnetInStorage,
    addRecentMagnet: recordDeletedMagnet,
    addManualMagnet: (id, title, magnet) => recordDeletedMagnet({ id, name: title, magnet }),
    removeRecentMagnet: removeDeletedMagnet,
    removeManualMagnet: removeDeletedMagnet,
    clearRecentMagnets: clearDeletedMagnets,
    clearDeletedMagnets,
    fetchRemoteMagnets
  };
}

