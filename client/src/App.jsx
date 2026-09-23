import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle
} from 'lucide-react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import api from './api/client';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import StorageCard from './components/StorageCard';
import SearchBar from './components/SearchBar';
import ActiveDownloads from './components/ActiveDownloads';
import CompletedFiles from './components/CompletedFiles';
import QueueManager from './components/QueueManager';
import RecentMagnetsModal from './components/RecentMagnetsModal';
import RecentLinksView from './components/RecentLinksView';
import MirrorMoviesView from './components/MirrorMoviesView';
import SettingsView from './components/SettingsView';
import TelegramBotView from './components/TelegramBotView';
import UserGuideCard from './components/UserGuideCard';
import BottomNav from './components/BottomNav';
import useSearch from './hooks/useSearch';
import useSeedr from './hooks/useSeedr';
import useQueue from './hooks/useQueue';
import { isOversizedForSeedr, formatBytes } from './utils/magnet';

function App() {
  const navigate = useNavigate();

  const { 
    search, 
    results, 
    loading: searchLoading, 
    error: searchError, 
    hasSearched, 
    lastQuery, 
    clearResults 
  } = useSearch();

  const { 
    activeTransfers, 
    cloudTorrents, 
    completedFiles, 
    storage, 
    folderContents, 
    loading: seedrLoading, 
    refreshFiles, 
    fetchFolderContents, 
    recentMagnets, 
    addMagnet, 
    getDownloadUrl, 
    deleteFile, 
    deleteFolder, 
    deleteTorrent, 
    deleteTask, 
    removeManualMagnet,
    clearRecentMagnets,
    registerActiveMagnet
  } = useSeedr();

  const {
    queue,
    isAutoEnabled,
    fetchQueue,
    addToQueue,
    removeFromQueue,
    moveItem,
    clearQueue,
    toggleAutoQueue
  } = useQueue();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [isMagnetsOpen, setIsMagnetsOpen] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/seedr_download_bot');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('seedr_theme');
      if (saved) return saved === 'dark';
    } catch (e) {}
    return false; // Light mode is default
  });

  useEffect(() => {
    try {
      localStorage.setItem('seedr_theme', isDarkMode ? 'dark' : 'light');
    } catch (e) {}
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    api.get('/telegram/status')
      .then((res) => {
        if (res.data?.botUsername) {
          setTelegramUrl(`https://t.me/${res.data.botUsername}`);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSearch = (query) => {
    navigate('/search');
    setSearchQuery(query);
    search(query);
  };

  const handleAddMagnet = async (magnet, name = '', size = null) => {
    // 1. Validate file size > 4.5 GB limit
    if (size && isOversizedForSeedr(size)) {
      showToast(`⚠️ Cannot download "${name || 'Torrent'}" (${size}): File size exceeds 4.5 GB cloud storage limit.`, 'error');
      return;
    }

    try {
      const res = await addMagnet(magnet, name, size);
      if (res && res.autoQueued) {
        showToast(`Cloud storage is currently full. "${name || 'Torrent'}" scheduled in Upcoming Queue!`, 'info');
        fetchQueue();
      } else {
        showToast('Added to Cloud! Converting to high-speed download...', 'success');
        if (!name) {
          setIsMagnetsOpen(true);
        }
      }
      return res;
    } catch (err) {
      const errDetail = err.response?.data?.error || err.message || '';
      if (err.response?.data?.isOversized || errDetail.includes('4.5 GB') || errDetail.includes('file_too_big')) {
        showToast(`⚠️ "${name || 'Torrent'}" exceeds 4.5 GB cloud limit and cannot be added.`, 'error');
      } else {
        showToast(errDetail || 'Failed to add to Cloud', 'error');
      }
      throw err;
    }
  };

  const handleAddToQueue = async (magnet, name = '', size = null) => {
    if (size && isOversizedForSeedr(size)) {
      showToast(`⚠️ Cannot schedule "${name || 'Torrent'}" (${size}): Exceeds 4.5 GB cloud limit.`, 'error');
      return;
    }

    try {
      if (registerActiveMagnet) {
        registerActiveMagnet({ magnet, name, size });
      }
      await addToQueue(magnet, name, size);
      showToast(`Scheduled "${name || 'Torrent'}" in queue!`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to schedule in queue', 'error');
    }
  };

  const handleSendFromQueueNow = async (magnet, name, queueId, size = null) => {
    if (size && isOversizedForSeedr(size)) {
      showToast(`⚠️ Cannot send "${name}" (${size}): Exceeds 4.5 GB cloud limit. Removing from queue...`, 'error');
      await removeFromQueue(queueId);
      return;
    }

    try {
      const res = await addMagnet(magnet, name, size);
      await removeFromQueue(queueId);
      showToast(`Sent "${name}" to Cloud immediately!`, 'success');
    } catch (err) {
      showToast('Failed to send to Cloud', 'error');
    }
  };

  const handleDownloadFile = async (fileId) => {
    try {
      const url = await getDownloadUrl(fileId);
      window.open(url, '_blank');
      showToast('Download started');
    } catch (err) {
      showToast('Failed to get download link', 'error');
    }
  };

  const handleDelete = async (id, type, parentFolderId = null) => {
    try {
      let itemMeta = null;
      if (type === 'torrent') {
        itemMeta = cloudTorrents.find(t => String(t.id) === String(id));
      } else if (type === 'folder' || type === 'file') {
        itemMeta = completedFiles.find(f => String(f.id) === String(id));
        if (!itemMeta && parentFolderId && folderContents[parentFolderId]) {
          const contents = folderContents[parentFolderId];
          const pool = type === 'folder' ? (contents.folders || []) : (contents.files || []);
          itemMeta = pool.find(item => String(item.id) === String(id));
        }
      }

      if (type === 'folder') {
        await deleteFolder(id, itemMeta);
        showToast('Folder deleted from Cloud');
      } else if (type === 'torrent') {
        await deleteTorrent(id, itemMeta);
        showToast('Active torrent cancelled & removed from Cloud');
      } else if (type === 'task') {
        await deleteTask(id);
        showToast('Task removed from Cloud');
      } else {
        await deleteFile(id, parentFolderId, itemMeta);
        showToast('File deleted from Cloud');
      }
      fetchQueue();
      setTimeout(fetchQueue, 1500);
      setTimeout(fetchQueue, 3500);
      setTimeout(fetchQueue, 6000);
    } catch (err) {
      showToast(`Failed to delete ${type}`, 'error');
      throw err;
    }
  };

  const handleCancelTransfer = async (id) => {
    try {
      await handleDelete(id, 'torrent');
    } catch (e) {
      showToast('Failed to cancel active download', 'error');
    }
  };

  const getToastStyles = (type) => {
    if (!isDarkMode) {
      switch (type) {
        case 'error':
          return 'bg-white border border-red-200 text-red-700 shadow-xl shadow-red-950/10';
        case 'info':
          return 'bg-white border border-indigo-200 text-indigo-700 shadow-xl shadow-indigo-950/10';
        case 'warning':
          return 'bg-white border border-amber-200 text-amber-700 shadow-xl shadow-amber-950/10';
        default:
          return 'bg-white border border-emerald-200 text-emerald-800 shadow-xl shadow-emerald-950/10';
      }
    }
    switch (type) {
      case 'error':
        return 'bg-red-950/90 border border-red-800 text-red-200 shadow-red-950/50';
      case 'info':
        return 'bg-indigo-950/90 border border-indigo-800 text-indigo-200 shadow-indigo-950/50';
      case 'warning':
        return 'bg-amber-950/90 border border-amber-800 text-amber-200 shadow-amber-950/50';
      default:
        return 'bg-emerald-950/90 border border-emerald-800 text-emerald-200 shadow-emerald-950/50';
    }
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400 shrink-0" />;
      case 'info':
        return <Info className="w-5 h-5 text-indigo-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      default:
        return <CheckCircle className="w-5 h-5 text-[#00DF81] shrink-0" />;
    }
  };

  return (
    <div className={`min-h-screen min-h-[100dvh] ${isDarkMode ? 'dark bg-[#070B14] text-slate-100' : 'light bg-[#F8FAFC] text-slate-900'} font-sans antialiased selection:bg-[#00DF81]/30 transition-colors duration-200 relative`}>
      
      {/* App Content Flex Container (Desktop Sidebar + Main Content) */}
      <div className="flex min-h-screen min-h-[100dvh]">
        {/* Desktop Left Sidebar (Fixed / Sticky at top of viewport) */}
        <div className="hidden md:block sticky top-0 h-screen z-40 shrink-0">
          <Sidebar 
            storage={storage}
            queueCount={queue.length}
            recentCount={recentMagnets.length}
            onOpenSettings={() => navigate('/settings')}
          />
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${isDarkMode ? 'bg-[#070B14]' : 'bg-[#F8FAFC]'}`}>
          {/* Top Navbar */}
          <Navbar 
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
          />

          {/* Page Body with React Router Views */}
          <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-4xl lg:max-w-5xl w-full mx-auto pb-28 md:pb-12">
            <Routes>
              {/* 1. Home / All Files Dashboard */}
              <Route 
                path="/" 
                element={
                  <>
                    <StorageCard 
                      storage={storage} 
                      onClickDetails={() => navigate('/settings')}
                    />

                    {searchError && (
                      <div className="bg-red-950/40 border border-red-800 text-red-400 p-4 rounded-2xl mb-6 text-sm">
                        {searchError}
                      </div>
                    )}

                    <ActiveDownloads 
                      transfers={activeTransfers} 
                      onCancel={(id, type) => handleDelete(id, type || 'torrent')}
                    />

                    <CompletedFiles 
                      files={completedFiles} 
                      activeTorrents={cloudTorrents}
                      storage={storage}
                      folderContents={folderContents}
                      loading={seedrLoading}
                      onRefresh={refreshFiles}
                      onFetchFolder={fetchFolderContents}
                      onDownload={handleDownloadFile} 
                      onDelete={handleDelete} 
                      getDownloadUrl={getDownloadUrl}
                    />

                    {queue.length > 0 && (
                      <QueueManager 
                        queue={queue}
                        isAutoEnabled={isAutoEnabled}
                        onMoveItem={moveItem}
                        onRemoveItem={removeFromQueue}
                        onClearQueue={clearQueue}
                        onToggleAuto={toggleAutoQueue}
                        onSendNow={handleSendFromQueueNow}
                      />
                    )}

                    <UserGuideCard />
                  </>
                } 
              />
              <Route path="/home" element={<Navigate to="/" replace />} />

              {/* 2. Torrent & Movie Search */}
              <Route 
                path="/search" 
                element={
                  <MirrorMoviesView 
                    onAddMagnet={handleAddMagnet}
                    queue={queue}
                    activeTransfers={activeTransfers}
                    onShowToast={(msg, type) => showToast(msg, type)}
                    onOpenSettings={() => navigate('/settings')}
                    onSearch={handleSearch}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                } 
              />

              {/* 3. Upcoming Queue */}
              <Route 
                path="/upcoming" 
                element={
                  <div className="space-y-5">
                    {activeTransfers.length > 0 && (
                      <ActiveDownloads transfers={activeTransfers} onCancel={handleCancelTransfer} />
                    )}

                    <SearchBar 
                      onAddMagnet={handleAddMagnet} 
                      loading={searchLoading} 
                      isQueueTab={true}
                    />

                    <QueueManager 
                      queue={queue}
                      isAutoEnabled={isAutoEnabled}
                      onMoveItem={moveItem}
                      onRemoveItem={removeFromQueue}
                      onClearQueue={clearQueue}
                      onToggleAuto={toggleAutoQueue}
                      onSendNow={handleSendFromQueueNow}
                      onShowToast={(msg, type) => showToast(msg, type)}
                    />
                  </div>
                } 
              />
              <Route path="/queue" element={<Navigate to="/upcoming" replace />} />

              {/* 4. Recent Links */}
              <Route 
                path="/recent" 
                element={
                  <RecentLinksView 
                    magnets={recentMagnets}
                    onRemove={removeManualMagnet}
                    onClearAll={clearRecentMagnets}
                    onRetry={(magnet, name) => handleAddMagnet(magnet, name)}
                    onSearch={handleSearch}
                    onAddMagnet={handleAddMagnet}
                    searchLoading={searchLoading}
                  />
                } 
              />

              {/* 5. Telegram Bot */}
              <Route path="/bot" element={<TelegramBotView />} />
              <Route path="/telegram" element={<Navigate to="/bot" replace />} />

              {/* 6. Settings (with Storage Details) */}
              <Route 
                path="/settings" 
                element={
                  <SettingsView 
                    storage={storage}
                    onShowToast={(msg, type) => showToast(msg, type)}
                    isDarkMode={isDarkMode}
                    onToggleTheme={() => setIsDarkMode(!isDarkMode)}
                  />
                } 
              />

              {/* Catch-all redirect to Home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <BottomNav 
        recentCount={recentMagnets.length}
        queueCount={queue.length}
      />

      {/* Recent Magnets Modal */}
      <RecentMagnetsModal 
        isOpen={isMagnetsOpen}
        onClose={() => setIsMagnetsOpen(false)}
        magnets={recentMagnets}
        onRemove={removeManualMagnet}
        onClearAll={clearRecentMagnets}
        onRetry={(magnet, name, size) => handleAddMagnet(magnet, name, size)}
        onAddMagnet={handleAddMagnet}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-[120] animate-in fade-in slide-in-from-bottom-4 max-w-sm sm:max-w-md">
          <div className={`px-4 sm:px-5 py-3 rounded-xl shadow-2xl font-medium flex items-center gap-3 text-xs sm:text-sm backdrop-blur-md ${getToastStyles(toast.type)}`}>
            {getToastIcon(toast.type)}
            <span className="flex-1">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
