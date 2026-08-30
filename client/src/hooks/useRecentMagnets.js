import { useState, useEffect, useCallback } from 'react';

const LOCAL_STORAGE_KEY = 'seedr_manual_magnets';

export default function useRecentMagnets() {
  const [recentMagnets, setRecentMagnets] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const saveMagnets = (magnets) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(magnets));
    } catch (e) {
      console.error('Failed to save manual magnets to localStorage:', e);
    }
  };

  const addManualMagnet = useCallback((id, title, magnet) => {
    setRecentMagnets(prev => {
      // Avoid duplicate IDs
      if (prev.some(m => m.id === id)) return prev;
      
      const newMagnet = {
        id,
        title: title || 'Magnet Transfer',
        magnet,
        progress: 0,
        status: 'Queued',
        downloadUrl: null,
        files: [],
        timestamp: Date.now()
      };
      const updated = [newMagnet, ...prev].slice(0, 15); // Limit to 15 items
      saveMagnets(updated);
      return updated;
    });
  }, []);

  const updateManualMagnet = useCallback((id, updates) => {
    setRecentMagnets(prev => {
      const updated = prev.map(m => {
        if (m.id === id) {
          return { ...m, ...updates };
        }
        return m;
      });
      saveMagnets(updated);
      return updated;
    });
  }, []);

  const removeManualMagnet = useCallback((id) => {
    setRecentMagnets(prev => {
      const updated = prev.filter(m => m.id !== id);
      saveMagnets(updated);
      return updated;
    });
  }, []);

  return {
    recentMagnets,
    addManualMagnet,
    updateManualMagnet,
    removeManualMagnet
  };
}
