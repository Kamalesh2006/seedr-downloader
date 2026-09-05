import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { extractMagnetName, extractMagnetHash } from '../utils/magnet';

const STORAGE_KEY = 'seedr_deleted_magnets_30d';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isDummyTestMagnet(item) {
  if (!item || (!item.magnet && !item.hash)) return true;
  const magnet = item.magnet || '';
  const hash = item.hash || '';
  // Filter out dummy test items with fake hashes (e.g. hash12, hash11, etc.)
  if (/^hash\d+$/i.test(hash) || /xt=urn:btih:hash\d+/i.test(magnet)) {
    return true;
  }
  return false;
}

function isWithin30Days(item) {
  if (!item || !item.deletedAt) return false;
  const time = new Date(item.deletedAt).getTime();
  if (isNaN(time)) return false;
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

  // Fetch 30-day deleted magnets from remote backend
  const fetchRemoteMagnets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/magnets/recent');
      if (res.data && Array.isArray(res.data.magnets)) {
        const cleanList = res.data.magnets.filter(item => !isDummyTestMagnet(item) && isWithin30Days(item));
        cleanList.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
        setDeletedMagnets(cleanList);
        syncLocal(cleanList);
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

    const magnet = (item.magnet || '').trim();
    const hash = (item.hash || (magnet ? extractMagnetHash(magnet) : '') || '').toLowerCase();
    const name = (item.name && item.name.trim()) || (item.title && item.title.trim()) || (magnet ? extractMagnetName(magnet) : '') || 'Torrent';

    const newEntry = {
      id: hash || item.id || `del-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      title: name,
      magnet: magnet || (hash ? `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}` : ''),
      hash,
      size: item.size || null,
      status: 'deleted',
      deletedAt: item.deletedAt || new Date().toISOString(),
      deletedReason: item.deletedReason || item.reason || 'Deleted from Seedr',
      addedAt: item.addedAt || null
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
    addRecentMagnet: recordDeletedMagnet,
    addManualMagnet: (id, title, magnet) => recordDeletedMagnet({ id, name: title, magnet }),
    removeRecentMagnet: removeDeletedMagnet,
    removeManualMagnet: removeDeletedMagnet,
    clearRecentMagnets: clearDeletedMagnets,
    clearDeletedMagnets,
    fetchRemoteMagnets
  };
}
