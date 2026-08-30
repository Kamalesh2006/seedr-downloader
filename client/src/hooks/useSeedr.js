import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import useRecentMagnets from './useRecentMagnets';
import { getMagnetDisplayName } from '../utils/magnet';

export default function useSeedr() {
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [completedFiles, setCompletedFiles] = useState([]);
  const [storage, setStorage] = useState({ spaceUsed: 0, spaceMax: 0 });
  const [folderContents, setFolderContents] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const pollingRef = useRef({});

  const {
    recentMagnets,
    addManualMagnet,
    updateManualMagnet,
    removeManualMagnet
  } = useRecentMagnets();

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

  const findDownloadLinksForTitle = useCallback(async (title) => {
    try {
      const { data: rootData } = await api.get('/seedr/folders');
      const folders = rootData.folders || [];
      const files = rootData.files || [];
      
      // Look in files first
      const fileMatch = files.find(f => f.name.toLowerCase() === title.toLowerCase());
      if (fileMatch) {
        const { data: dl } = await api.get(`/seedr/download/${fileMatch.id}`);
        return [{ name: fileMatch.name, url: dl.url }];
      }
      
      // Look in folders
      const folderMatch = folders.find(f => f.name.toLowerCase() === title.toLowerCase());
      if (folderMatch) {
        const { data: folderData } = await api.get(`/seedr/folder/${folderMatch.id}`);
        const folderFiles = folderData.files || [];
        const results = [];
        for (const file of folderFiles) {
          try {
            const { data: dl } = await api.get(`/seedr/download/${file.id}`);
            results.push({ name: file.name, url: dl.url });
          } catch (e) {
            console.error('Failed to get download URL for file in folder:', file.name, e);
          }
        }
        return results;
      }
    } catch (e) {
      console.error('Error finding download links for title:', title, e);
    }
    return [];
  }, []);

  const pollManualTransfer = useCallback(async (transferId, title) => {
    if (pollingRef.current[transferId]) return;
    pollingRef.current[transferId] = true;

    const checkStatus = async () => {
      try {
        const { data } = await api.get(`/seedr/status/${transferId}`);
        const { status, progress } = data;
        
        updateManualMagnet(transferId, {
          progress: progress || 0,
          status: status || 'downloading'
        });

        if (progress >= 100 || status === 'finished') {
          pollingRef.current[transferId] = false;
          updateManualMagnet(transferId, {
            progress: 100,
            status: 'finished'
          });
          
          setTimeout(async () => {
            const urls = await findDownloadLinksForTitle(title);
            updateManualMagnet(transferId, { files: urls || [] });
            refreshFiles();
          }, 3000);
          
          return;
        }

        setTimeout(checkStatus, 3000);
      } catch (err) {
        console.error('Error polling manual transfer, fallback to matching root folder/files', err);
        pollingRef.current[transferId] = false;
        
        // Fallback: If Seedr deleted the transfer because it completed, check root list
        setTimeout(async () => {
          const urls = await findDownloadLinksForTitle(title);
          if (urls && urls.length > 0) {
            updateManualMagnet(transferId, {
              progress: 100,
              status: 'finished',
              files: urls
            });
          } else {
            updateManualMagnet(transferId, {
              status: 'failed'
            });
          }
          refreshFiles();
        }, 3000);
      }
    };
    checkStatus();
  }, [updateManualMagnet, findDownloadLinksForTitle, refreshFiles]);

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
      const parsedName = name || getMagnetDisplayName(magnet);
      const { data } = await api.post('/seedr/add', { magnet });
      if (data.id) {
        const finalTitle = data.title || parsedName;
        // Track manual magnet
        addManualMagnet(data.id, finalTitle, magnet);
        // Start polling
        pollManualTransfer(data.id, finalTitle);
        // Also show in standard active transfers panel
        pollTransfer(data.id, finalTitle);
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
      if (parentFolderId) {
        fetchFolderContents(parentFolderId);
      }
      refreshFiles();
    } catch (err) {
      console.error('Failed to delete file', err);
      throw err;
    }
  };
  
  const deleteFolder = async (folderId) => {
    try {
      await api.delete(`/seedr/folder/${folderId}`);
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

  // Re-poll incomplete manual magnets on mount/update
  useEffect(() => {
    recentMagnets.forEach(m => {
      if (m.progress < 100 && m.status !== 'finished' && m.status !== 'failed') {
        if (!pollingRef.current[m.id]) {
          pollManualTransfer(m.id, m.title);
        }
      }
    });
  }, [recentMagnets, pollManualTransfer]);

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
    recentMagnets,
    addMagnet,
    pollTransfer,
    refreshFiles,
    fetchFolderContents,
    getDownloadUrl,
    deleteFile,
    deleteFolder,
    removeManualMagnet
  };
}
