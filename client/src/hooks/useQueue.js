import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

const QUEUE_STORAGE_KEY = 'seedr_client_queue';

export default function useQueue() {
  const [queue, setQueue] = useState(() => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  const [isAutoEnabled, setIsAutoEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef(null);

  const syncLocal = useCallback((items) => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items || []));
    } catch (e) {
      console.error('Failed to sync queue to local storage', e);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const { data } = await api.get('/queue');
      const remoteQueue = Array.isArray(data.queue) ? data.queue : [];
      setIsAutoEnabled(data.isAutoEnabled !== undefined ? data.isAutoEnabled : true);
      setIsProcessing(!!data.isProcessing);

      setQueue(prev => {
        // Safe merge: if server returned 0 items but local had items (e.g. fresh lambda cold start), sync upstream
        if (remoteQueue.length === 0 && prev.length > 0) {
          api.post('/queue/sync', { queue: prev }).catch(() => {});
          return prev;
        }

        // If server returned items, server is source of truth
        syncLocal(remoteQueue);
        return remoteQueue;
      });
    } catch (err) {
      console.warn('Failed to fetch download queue from server, using local mirror:', err.message);
    }
  }, [syncLocal]);

  const addToQueue = async (magnet, name = '', size = null) => {
    setLoading(true);
    try {
      const { data } = await api.post('/queue/add', { magnet, name, size });
      const updatedQueue = data.queue || (data.item ? [...queue, data.item] : queue);
      setQueue(updatedQueue);
      syncLocal(updatedQueue);
      await fetchQueue();
      return data;
    } catch (err) {
      console.error('Failed to add item to queue', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeFromQueue = async (id) => {
    try {
      const updated = queue.filter(item => item.id !== id);
      setQueue(updated);
      syncLocal(updated);
      await api.delete(`/queue/${id}`);
      await fetchQueue();
    } catch (err) {
      console.error('Failed to remove item from queue', err);
      throw err;
    }
  };

  const moveItem = async (id, direction) => {
    try {
      await api.post('/queue/move', { id, direction });
      await fetchQueue();
    } catch (err) {
      console.error('Failed to move item in queue', err);
      throw err;
    }
  };

  const clearQueue = async () => {
    try {
      setQueue([]);
      syncLocal([]);
      await api.post('/queue/clear');
      await fetchQueue();
    } catch (err) {
      console.error('Failed to clear queue', err);
      throw err;
    }
  };

  const toggleAutoQueue = async (enabled) => {
    try {
      const { data } = await api.post('/queue/toggle', { enabled });
      setIsAutoEnabled(data.isAutoEnabled);
      await fetchQueue();
    } catch (err) {
      console.error('Failed to toggle auto processor', err);
    }
  };

  const processNow = async () => {
    try {
      const { data } = await api.post('/queue/process-now');
      if (data && data.queue) {
        setQueue(data.queue);
        syncLocal(data.queue);
      }
      await fetchQueue();
    } catch (err) {
      console.error('Failed to trigger immediate queue process', err);
    }
  };

  // Triggers immediate and delayed queue processing to guarantee Seedr space propagation is caught
  const triggerDelayedQueueProcess = useCallback(() => {
    api.post('/queue/process-now').catch(() => {});
    setTimeout(() => {
      api.post('/queue/process-now').then(() => fetchQueue()).catch(() => {});
    }, 2500);
    setTimeout(() => {
      api.post('/queue/process-now').then(() => fetchQueue()).catch(() => {});
    }, 5500);
  }, [fetchQueue]);

  useEffect(() => {
    fetchQueue();
    pollTimerRef.current = setInterval(fetchQueue, 5000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchQueue]);

  return {
    queue,
    isAutoEnabled,
    isProcessing,
    loading,
    fetchQueue,
    addToQueue,
    removeFromQueue,
    moveItem,
    clearQueue,
    toggleAutoQueue,
    processNow,
    triggerDelayedQueueProcess
  };
}
