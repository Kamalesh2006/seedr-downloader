import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

export default function useSeedr() {
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [completedFiles, setCompletedFiles] = useState([]);
  const [storage, setStorage] = useState({ spaceUsed: 0, spaceMax: 0 });
  const [folderContents, setFolderContents] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const pollingRef = useRef({});

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: folderData } = await api.get('/seedr/folders');
      const folders = folderData.folders || [];
      const files = folderData.files || [];
      const flatFiles = [];
      
      for (const f of folders) {
        flatFiles.push({ ...f, type: 'folder' });
      }

      for (const file of files) {
        flatFiles.push({ ...file, type: 'file' });
      }

      setCompletedFiles(flatFiles);
      
      if (folderData.space_used !== undefined && folderData.space_max !== undefined) {
        setStorage({
          spaceUsed: folderData.space_used || 0,
          spaceMax: folderData.space_max || 0
        });
      }
    } catch (err) {
      console.error('Failed to refresh Seedr files', err);
      setError(err.response?.data?.error || err.message || 'Failed to refresh files from Seedr');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFolderContents = useCallback(async (folderId) => {
    if (!folderId) return;

    setFolderContents(prev => ({
      ...prev,
      [folderId]: { ...prev[folderId], loading: true, error: null }
    }));

    try {
      const { data } = await api.get(`/seedr/folder/${folderId}`);
      const files = (data.files || []).map(f => ({ ...f, type: 'file', parentFolderId: folderId }));
      const folders = (data.folders || []).map(f => ({ ...f, type: 'folder', parentFolderId: folderId }));
      
      setFolderContents(prev => ({
        ...prev,
        [folderId]: {
          files,
          folders,
          name: data.name || '',
          loading: false,
          loaded: true,
          error: null
        }
      }));
      return { files, folders };
    } catch (err) {
      console.error(`Failed to fetch folder ${folderId} contents`, err);
      setFolderContents(prev => ({
        ...prev,
        [folderId]: {
          files: [],
          folders: [],
          loading: false,
          loaded: false,
          error: err.response?.data?.error || err.message || 'Failed to load folder'
        }
      }));
      throw err;
    }
  }, []);

  const pollTransfer = useCallback(async (transferId, name) => {
    if (pollingRef.current[transferId]) return;
    pollingRef.current[transferId] = true;

    setActiveTransfers(prev => {
      const existing = prev.find(t => t.id === transferId);
      if (existing) return prev;
      return [...prev, { id: transferId, name: name || 'Torrent Transfer', progress: 0, status: 'Queued' }];
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

  const deleteFile = async (fileId, parentFolderId = null) => {
    try {
      await api.delete(`/seedr/file/${fileId}`);
      
      // If file was deleted from inside a subfolder, refresh that subfolder
      if (parentFolderId) {
        fetchFolderContents(parentFolderId);
      }
      // Also refresh root files and storage metrics
      refreshFiles();
    } catch (err) {
      console.error('Failed to delete file', err);
      throw err;
    }
  };
  
  const deleteFolder = async (folderId) => {
    try {
      await api.delete(`/seedr/folder/${folderId}`);
      // Remove from folderContents cache if present
      setFolderContents(prev => {
        const next = { ...prev };
        delete next[folderId];
        return next;
      });
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
    storage,
    folderContents,
    loading,
    error,
    addMagnet,
    pollTransfer,
    refreshFiles,
    fetchFolderContents,
    getDownloadUrl,
    deleteFile,
    deleteFolder
  };
}
