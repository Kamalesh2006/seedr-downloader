import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import useRecentMagnets from './useRecentMagnets';
import { getMagnetDisplayName } from '../utils/magnet';

export default function useSeedr() {
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [cloudTorrents, setCloudTorrents] = useState([]);
  const [cloudTasks, setCloudTasks] = useState([]);
  const [completedFiles, setCompletedFiles] = useState([]);
  const [storage, setStorage] = useState({ spaceUsed: 0, spaceMax: 0 });
  const [folderContents, setFolderContents] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const pollingRef = useRef({});
  const pollTimerRef = useRef(null);

  const {
    recentMagnets,
    deletedMagnets,
    recordDeletedMagnet,
    registerActiveMagnet,
    findActiveMagnet,
    removeManualMagnet,
    clearRecentMagnets
  } = useRecentMagnets();

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: folderData } = await api.get('/seedr/folders');
      const folders = folderData.folders || [];
      const files = folderData.files || [];
      const torrents = folderData.torrents || [];
      const tasks = folderData.tasks || [];
      
      const flatFiles = [];
      
      for (const f of folders) {
        flatFiles.push({ ...f, type: 'folder' });
      }

      for (const file of files) {
        flatFiles.push({ ...file, type: 'file' });
      }

      setCompletedFiles(flatFiles);
      setCloudTorrents(torrents);
      setCloudTasks(tasks);

      // Merge cloud torrents and local transfers into unified activeTransfers list
      const combinedTransfers = [
        ...torrents.map(t => ({
          id: t.id,
          name: t.name || 'Cloud Torrent',
          size: t.size || 0,
          progress: t.progress || 0,
          status: t.status || (t.stopped ? 'Stopped' : 'downloading'),
          type: 'torrent',
          seeders: t.seeders,
          downloadRate: t.download_rate
        })),
        ...tasks.map(tsk => ({
          id: tsk.id,
          name: tsk.name || 'Cloud Task',
          size: tsk.size || 0,
          progress: 0,
          status: 'Processing',
          type: 'task'
        }))
      ];
      setActiveTransfers(combinedTransfers);
      
      if (folderData.space_used !== undefined && folderData.space_max !== undefined) {
        setStorage({
          spaceUsed: folderData.space_used || 0,
          spaceMax: folderData.space_max || 0
        });
      }

      // Auto-schedule next poll if there are active torrents or tasks in Seedr
      if (torrents.length > 0 || tasks.length > 0) {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = setTimeout(() => {
          refreshFiles();
        }, 3000);
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

  const addMagnet = async (magnet, name = '', size = null) => {
    try {
      const parsedName = name || getMagnetDisplayName(magnet);
      if (registerActiveMagnet) {
        registerActiveMagnet({ magnet, name: parsedName, size });
      }
      const { data } = await api.post('/seedr/add', { magnet, name: parsedName, size });
      if (data && (data.user_torrent_id || data.id) && registerActiveMagnet) {
        registerActiveMagnet({
          magnet,
          name: data.title || parsedName,
          size,
          id: data.user_torrent_id || data.id,
          hash: data.torrent_hash
        });
      }
      // Immediately refresh files and torrents
      refreshFiles();
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

  const triggerQueueProcessing = useCallback(() => {
    // Stage 1: Immediate wake-up
    api.post('/queue/process-now').catch(() => {});
    // Stage 2: After 2 seconds for Seedr cloud space metric propagation
    setTimeout(() => {
      api.post('/queue/process-now').then(() => refreshFiles()).catch(() => {});
    }, 2000);
    // Stage 3: Follow-up check after 4.5 seconds
    setTimeout(() => {
      api.post('/queue/process-now').then(() => refreshFiles()).catch(() => {});
    }, 4500);
  }, [refreshFiles]);

  const deleteFile = async (fileId, parentFolderId = null, fileMeta = null) => {
    try {
      const fileName = (fileMeta && fileMeta.name) || '';
      const fileSize = (fileMeta && fileMeta.size) || null;
      const matched = findActiveMagnet ? findActiveMagnet({ id: fileId, name: fileName, size: fileSize }) : null;

      const enrichedMeta = {
        id: fileId,
        name: fileName || (matched && matched.name) || 'File',
        size: fileSize || (matched && matched.size) || null,
        hash: (fileMeta && fileMeta.hash) || (matched && matched.hash) || null,
        magnet: (fileMeta && fileMeta.magnet) || (matched && matched.magnet) || null,
        deletedReason: 'Deleted file from Seedr'
      };

      recordDeletedMagnet(enrichedMeta);

      await api.delete(`/seedr/file/${fileId}`, { data: enrichedMeta });
      if (parentFolderId) {
        fetchFolderContents(parentFolderId);
      }
      refreshFiles();
      triggerQueueProcessing();
    } catch (err) {
      console.error('Failed to delete file', err);
      throw err;
    }
  };
  
  const deleteFolder = async (folderId, folderMeta = null) => {
    try {
      const folderName = (folderMeta && folderMeta.name) || '';
      const folderSize = (folderMeta && folderMeta.size) || null;
      const matched = findActiveMagnet ? findActiveMagnet({ id: folderId, name: folderName, size: folderSize }) : null;

      const enrichedMeta = {
        id: folderId,
        name: folderName || (matched && matched.name) || 'Folder',
        size: folderSize || (matched && matched.size) || null,
        hash: (folderMeta && folderMeta.hash) || (matched && matched.hash) || null,
        magnet: (folderMeta && folderMeta.magnet) || (matched && matched.magnet) || null,
        deletedReason: 'Deleted folder from Seedr'
      };

      recordDeletedMagnet(enrichedMeta);

      await api.delete(`/seedr/folder/${folderId}`, { data: enrichedMeta });
      setFolderContents(prev => {
        const next = { ...prev };
        delete next[folderId];
        return next;
      });
      refreshFiles();
      triggerQueueProcessing();
    } catch (err) {
      console.error('Failed to delete folder', err);
      throw err;
    }
  };

  const deleteTorrent = async (torrentId, torrentMeta = null) => {
    try {
      const torrentName = (torrentMeta && torrentMeta.name) || '';
      const torrentSize = (torrentMeta && torrentMeta.size) || null;
      const matched = findActiveMagnet ? findActiveMagnet({ id: torrentId, name: torrentName, size: torrentSize }) : null;

      const enrichedMeta = {
        id: torrentId,
        name: torrentName || (matched && matched.name) || 'Active Torrent',
        size: torrentSize || (matched && matched.size) || null,
        hash: (torrentMeta && torrentMeta.hash) || (matched && matched.hash) || null,
        magnet: (torrentMeta && torrentMeta.magnet) || (matched && matched.magnet) || null,
        deletedReason: 'Deleted active torrent from Seedr'
      };

      recordDeletedMagnet(enrichedMeta);

      await api.delete(`/seedr/torrent/${torrentId}`, { data: enrichedMeta });
      refreshFiles();
      triggerQueueProcessing();
    } catch (err) {
      console.error('Failed to delete torrent', err);
      throw err;
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/seedr/task/${taskId}`);
      refreshFiles();
      triggerQueueProcessing();
    } catch (err) {
      console.error('Failed to delete task', err);
      throw err;
    }
  };

  useEffect(() => {
    refreshFiles();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollingRef.current = {};
    };
  }, [refreshFiles]);

  return {
    activeTransfers,
    cloudTorrents,
    cloudTasks,
    completedFiles,
    storage,
    folderContents,
    loading,
    error,
    recentMagnets,
    deletedMagnets,
    recordDeletedMagnet,
    registerActiveMagnet,
    findActiveMagnet,
    addMagnet,
    refreshFiles,
    fetchFolderContents,
    getDownloadUrl,
    deleteFile,
    deleteFolder,
    deleteTorrent,
    deleteTask,
    removeManualMagnet,
    clearRecentMagnets
  };
}
