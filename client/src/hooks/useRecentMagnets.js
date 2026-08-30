import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { extractMagnetName, extractMagnetHash } from '../utils/magnet';

const STORAGE_KEY = 'seedr_recent_magnets';
const MAX_RECENT_ITEMS = 30;

function isDummyTestMagnet(item) {
  if (!item || !item.magnet) return true;
  const magnet = item.magnet || '';
  const hash = item.hash || '';
  const name = item.name || item.title || '';
  // Filter out dummy test items with fake hashes (e.g. hash12, hash11, etc.)
  if (/^hash\d+$/i.test(hash) || /xt=urn:btih:hash\d+/i.test(magnet)) {
    return true;
  }
  if (/^Torrent \d+$/i.test(name) && /hash\d+/i.test(magnet)) {
    return true;
  }
  return false;
}

export default function useRecentMagnets() {
  const [recentMagnets, setRecentMagnets] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(item => !isDummyTestMagnet(item)) : [];
    } catch (e) {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);

  // Sync to local cache helper
  const syncLocal = useCallback((items) => {
    try {
      const cleanItems = (items || []).filter(item => !isDummyTestMagnet(item));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanItems));
    } catch (e) {
      console.error('Failed to sync to local cache', e);
    }
  }, []);

  // Fetch from remote backend on mount
  const fetchRemoteMagnets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/magnets/recent');
      if (res.data && Array.isArray(res.data.magnets)) {
        const cleanList = res.data.magnets.filter(item => !isDummyTestMagnet(item));
        setRecentMagnets(cleanList);
        syncLocal(cleanList);
      }
    } catch (err) {
      console.warn('Failed to load recent magnets from remote server, using cached/local:', err.message);
    } finally {
      setLoading(false);
    }
  }, [syncLocal]);

  useEffect(() => {
    fetchRemoteMagnets();
  }, [fetchRemoteMagnets]);

  const addRecentMagnet = useCallback(async (item) => {
    if (!item || !item.magnet) return;

    const magnet = item.magnet.trim();
    const hash = extractMagnetHash(magnet);
    const name = (item.name && item.name.trim()) || (item.title && item.title.trim()) || extractMagnetName(magnet);

    const newEntry = {
      id: item.id || hash || `mag-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: name || 'Magnet Download',
      title: name || 'Magnet Download',
      magnet,
      hash,
      size: item.size || null,
      status: item.status || 'queued',
      progress: item.progress || 0,
      files: item.files || [],
      addedAt: item.addedAt || new Date().toISOString()
    };

    // Optimistic UI update
    setRecentMagnets(prev => {
      const filtered = prev.filter(entry => {
        if (hash && entry.hash) {
          return entry.hash.toLowerCase() !== hash.toLowerCase();
        }
        return entry.magnet.trim() !== magnet;
      });
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_ITEMS);
      syncLocal(updated);
      return updated;
    });

    // Remote persistence
    try {
      const res = await api.post('/magnets/recent', newEntry);
      if (res.data && Array.isArray(res.data.magnets)) {
        setRecentMagnets(res.data.magnets);
        syncLocal(res.data.magnets);
      }
    } catch (err) {
      console.error('Failed to sync added magnet to remote storage:', err);
    }
  }, [syncLocal]);

  const addManualMagnet = useCallback((id, title, magnet) => {
    addRecentMagnet({ id, name: title, title, magnet });
  }, [addRecentMagnet]);

  const updateManualMagnet = useCallback(async (id, updates) => {
    if (!id) return;

    // Optimistic UI update
    setRecentMagnets(prev => {
      const updated = prev.map(item => {
        if (item.id === id || (item.hash && item.hash.toLowerCase() === id.toLowerCase())) {
          return { ...item, ...updates };
        }
        return item;
      });
      syncLocal(updated);
      return updated;
    });

    // Remote persistence
    try {
      const res = await api.put(`/magnets/recent/${id}`, updates);
      if (res.data && Array.isArray(res.data.magnets)) {
        setRecentMagnets(res.data.magnets);
        syncLocal(res.data.magnets);
      }
    } catch (err) {
      console.error('Failed to sync updated magnet to remote storage:', err);
    }
  }, [syncLocal]);

  const removeRecentMagnet = useCallback(async (id) => {
    if (!id) return;

    // Optimistic UI update
    setRecentMagnets(prev => {
      const updated = prev.filter(item => item.id !== id && item.hash !== id);
      syncLocal(updated);
      return updated;
    });

    // Remote persistence
    try {
      const res = await api.delete(`/magnets/recent/${id}`);
      if (res.data && Array.isArray(res.data.magnets)) {
        setRecentMagnets(res.data.magnets);
        syncLocal(res.data.magnets);
      }
    } catch (err) {
      console.error('Failed to sync deleted magnet to remote storage:', err);
    }
  }, [syncLocal]);

  const removeManualMagnet = useCallback((id) => {
    removeRecentMagnet(id);
  }, [removeRecentMagnet]);

  const clearRecentMagnets = useCallback(async () => {
    setRecentMagnets([]);
    syncLocal([]);
    try {
      const res = await api.delete('/magnets/recent');
      if (res.data && Array.isArray(res.data.magnets)) {
        setRecentMagnets(res.data.magnets);
        syncLocal(res.data.magnets);
      }
    } catch (err) {
      console.error('Failed to clear magnets on remote storage:', err);
    }
  }, [syncLocal]);

  return {
    recentMagnets,
    loading,
    addRecentMagnet,
    addManualMagnet,
    updateManualMagnet,
    removeRecentMagnet,
    removeManualMagnet,
    clearRecentMagnets,
    fetchRemoteMagnets,
    maxLimit: MAX_RECENT_ITEMS
  };
}
