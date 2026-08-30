import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

export default function useSeedr() {
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [completedFiles, setCompletedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const pollingRef = useRef({});

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: folderData } = await api.get('/seedr/folders');
      const folders = folderData.folders || [];
      const flatFiles = [];
      
      for (const f of folders) {
        flatFiles.push({ ...f, type: 'folder' });
      }

      if (folderData.files) {
        for (const file of folderData.files) {
          flatFiles.push({ ...file, type: 'file' });
        }
      }

      setCompletedFiles(flatFiles);
    } catch (err) {
      console.error('Failed to refresh files', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const pollTransfer = useCallback(async (transferId, name) => {
    if (pollingRef.current[transferId]) return;
    pollingRef.current[transferId] = true;

    setActiveTransfers(prev => {
      const existing = prev.find(t => t.id === transferId);
      if (existing) return prev;
      return [...prev, { id: transferId, name, progress: 0, status: 'Queued' }];
    });

    const checkStatus = async () => {
      try {
        const { data } = await api.get(`/seedr/status/${transferId}`);
        const { status, progress } = data;
        
        setActiveTransfers(prev => 
          prev.map(t => t.id === transferId ? { ...t, progress: progress || 0, status: status || t.status } : t)
        );

        if (progress >= 100 || status === 'finished') {
          setActiveTransfers(prev => prev.filter(t => t.id !== transferId));
          pollingRef.current[transferId] = false;
          refreshFiles();
          return;
        }

        setTimeout(checkStatus, 3000);
      } catch (err) {
        console.error('Error polling transfer', err);
        pollingRef.current[transferId] = false;
        setActiveTransfers(prev => prev.filter(t => t.id !== transferId));
      }
    };
    checkStatus();
  }, [refreshFiles]);

  const addMagnet = async (magnet, name) => {
    try {
      const { data } = await api.post('/seedr/add', { magnet });
      if (data.id) {
        pollTransfer(data.id, name || 'Magnet Transfer');
      }
      return data;
    } catch (err) {
      console.error('Failed to add magnet', err);
      throw err;
    }
  };

  const getDownloadUrl = async (fileId) => {
    try {
      const { data } = await api.get(`/seedr/download/${fileId}`);
      return data.url;
    } catch (err) {
      console.error('Failed to get download url', err);
      throw err;
    }
  };

  const deleteFile = async (fileId) => {
    try {
      await api.delete(`/seedr/file/${fileId}`);
      refreshFiles();
    } catch (err) {
      console.error('Failed to delete file', err);
      throw err;
    }
  };
  
  const deleteFolder = async (folderId) => {
    try {
      await api.delete(`/seedr/folder/${folderId}`);
      refreshFiles();
    } catch (err) {
      console.error('Failed to delete folder', err);
      throw err;
    }
  };

  useEffect(() => {
    refreshFiles();
    return () => {
      pollingRef.current = {};
    };
  }, [refreshFiles]);

  return {
    activeTransfers,
    completedFiles,
    loading,
    addMagnet,
    pollTransfer,
    refreshFiles,
    getDownloadUrl,
    deleteFile,
    deleteFolder
  };
}
