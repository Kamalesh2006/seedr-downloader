import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

export default function useQueue() {
  const [queue, setQueue] = useState([]);
  const [isAutoEnabled, setIsAutoEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    try {
      const { data } = await api.get('/queue');
      setQueue(data.queue || []);
      setIsAutoEnabled(data.isAutoEnabled !== undefined ? data.isAutoEnabled : true);
      setIsProcessing(!!data.isProcessing);
    } catch (err) {
      console.error('Failed to fetch download queue', err);
    }
  }, []);

  const addToQueue = async (magnet, name = '', size = null) => {
    setLoading(true);
    try {
      const { data } = await api.post('/queue/add', { magnet, name, size });
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
      await api.post('/queue/process-now');
      await fetchQueue();
    } catch (err) {
      console.error('Failed to trigger immediate queue process', err);
    }
  };

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
    processNow
  };
}
