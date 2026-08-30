import { useState, useEffect, useCallback } from 'react';
import { extractMagnetName, extractMagnetHash } from '../utils/magnet';

const STORAGE_KEY = 'seedr_recent_magnets';
const MAX_RECENT_ITEMS = 10;

export default function useRecentMagnets() {
  const [recentMagnets, setRecentMagnets] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load recent magnets from storage', e);
      return [];
    }
  });

  const saveToStorage = useCallback((items) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save recent magnets to storage', e);
    }
  }, []);

  const addRecentMagnet = useCallback((item) => {
    if (!item || !item.magnet) return;

    const magnet = item.magnet.trim();
    const hash = extractMagnetHash(magnet);
    const name = (item.name && item.name.trim()) || extractMagnetName(magnet);

    setRecentMagnets(prev => {
      // Check if already exists (match by hash or magnet URL)
      const filtered = prev.filter(entry => {
        if (hash && entry.hash) {
          return entry.hash.toLowerCase() !== hash.toLowerCase();
        }
        return entry.magnet.trim() !== magnet;
      });

      const newEntry = {
        id: hash || `mag-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: name || 'Magnet Link',
        magnet,
        hash,
        size: item.size || null,
        addedAt: new Date().toISOString()
      };

      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_ITEMS);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const removeRecentMagnet = useCallback((id) => {
    setRecentMagnets(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const clearRecentMagnets = useCallback(() => {
    setRecentMagnets([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear recent magnets', e);
    }
  }, []);

  return {
    recentMagnets,
    addRecentMagnet,
    removeRecentMagnet,
    clearRecentMagnets,
    maxLimit: MAX_RECENT_ITEMS
  };
}
