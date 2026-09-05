import React, { useState, useEffect } from 'react';
import { 
  CloudRain, 
  Send, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle, 
  HardDrive, 
  Sparkles, 
  ExternalLink,
  RefreshCw,
  Folder
} from 'lucide-react';
import api from './api/client';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import StorageCard from './components/StorageCard';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import ActiveDownloads from './components/ActiveDownloads';
import CompletedFiles from './components/CompletedFiles';
import QueueManager from './components/QueueManager';
import RecentMagnetsModal from './components/RecentMagnetsModal';
import RecentLinksView from './components/RecentLinksView';
import MirrorMoviesView from './components/MirrorMoviesView';
import SettingsModal from './components/SettingsModal';
import BottomNav from './components/BottomNav';
import useSearch from './hooks/useSearch';
import useSeedr from './hooks/useSeedr';
import useQueue from './hooks/useQueue';
import { isOversizedForSeedr, formatBytes } from './utils/magnet';

function App() {
  const { search, results, loading: searchLoading, error: searchError } = useSearch();
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
    clearRecentMagnets
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
  
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [dashboardMode, setDashboardMode] = useState('magnet');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [isMagnetsOpen, setIsMagnetsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    search(query);
  };

  const handleAddMagnet = async (magnet, name = '', size = null) => {
    // 1. Validate file size > 4.5 GB limit
    if (size && isOversizedForSeedr(size)) {
      showToast(`⚠️ Cannot download "${name || 'Torrent'}" (${size}): File size exceeds Seedr's 4.5 GB total storage limit.`, 'error');
      return;
    }

    try {
      const res = await addMagnet(magnet, name, size);
      if (res && res.autoQueued) {
        showToast(`Seedr is currently occupied. "${name || 'Torrent'}" scheduled in Upcoming Queue!`, 'info');
        fetchQueue();
      } else {
        showToast('Added to Seedr cloud! Fetching progress...', 'success');
        if (!name) {
          setIsMagnetsOpen(true);
        }
      }
    } catch (err) {
      const errDetail = err.response?.data?.error || err.message || '';
      if (err.response?.data?.isOversized || errDetail.includes('4.5 GB') || errDetail.includes('file_too_big')) {
        showToast(`⚠️ "${name || 'Torrent'}" exceeds Seedr's 4.5 GB storage limit and cannot be added.`, 'error');
      } else {
        showToast(errDetail || 'Failed to add to Seedr', 'error');
      }
    }
  };

  const handleAddToQueue = async (magnet, name = '', size = null) => {
    if (size && isOversizedForSeedr(size)) {
      showToast(`⚠️ Cannot schedule "${name || 'Torrent'}" (${size}): Exceeds Seedr 4.5 GB limit.`, 'error');
      return;
    }

    try {
      await addToQueue(magnet, name, size);
      showToast(`Scheduled "${name || 'Torrent'}" in queue!`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to schedule in queue', 'error');
    }
  };

  const handleSendFromQueueNow = async (magnet, name, queueId, size = null) => {
    if (size && isOversizedForSeedr(size)) {
      showToast(`⚠️ Cannot send "${name}" (${size}): Exceeds Seedr 4.5 GB limit. Removing from queue...`, 'error');
      await removeFromQueue(queueId);
      return;
    }

    try {
      const res = await addMagnet(magnet, name, size);
      await removeFromQueue(queueId);
      showToast(`Sent "${name}" to Seedr immediately!`, 'success');
    } catch (err) {
      showToast('Failed to send to Seedr', 'error');
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
      }

      if (type === 'folder') {
        await deleteFolder(id, itemMeta);
        showToast('Folder deleted from Seedr (Saved to 30-day deleted links)');
      } else if (type === 'torrent') {
        await deleteTorrent(id, itemMeta);
        showToast('Active torrent cancelled & removed from Seedr (Saved to 30-day deleted links)');
      } else if (type === 'task') {
        await deleteTask(id);
        showToast('Task removed from Seedr');
      } else {
        await deleteFile(id, parentFolderId, itemMeta);
        showToast('File deleted from Seedr (Saved to 30-day deleted links)');
      }
      fetchQueue();
    } catch (err) {
      showToast(`Failed to delete ${type}`, 'error');
      throw err;
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

  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024);
  const usedPercentage = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

  return (
    <div className={`min-h-screen min-h-[100dvh] ${isDarkMode ? 'dark bg-[#070B14] text-slate-100' : 'light bg-[#F8FAFC] text-slate-900'} font-sans antialiased selection:bg-[#00DF81]/30 transition-colors duration-200 relative`}>
      
      {/* App Content Flex Container (Desktop Sidebar + Main Content) */}
      <div className="flex min-h-screen min-h-[100dvh]">
        {/* Desktop Left Sidebar (Fixed / Sticky at top of viewport) */}
        <div className="hidden md:block sticky top-0 h-screen z-40 shrink-0">
          <Sidebar 
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            storage={storage}
            queueCount={queue.length}
            recentCount={recentMagnets.length}
            telegramUrl={telegramUrl}
            onOpenRecent={() => setIsMagnetsOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${isDarkMode ? 'bg-[#070B14]' : 'bg-[#F8FAFC]'}`}>
          {/* Top Navbar */}
          <Navbar 
            currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenRecent={() => setIsMagnetsOpen(true)}
          queueCount={queue.length}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Page Body */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-4xl lg:max-w-5xl w-full mx-auto pb-28 md:pb-12">
          {currentTab === 'dashboard' && (
            <>
              {/* Top Search & Magnet Input Card */}
              <SearchBar 
                onSearch={handleSearch} 
                onAddMagnet={handleAddMagnet} 
                onAddToQueue={handleAddToQueue}
                loading={searchLoading} 
                queueCount={queue.length}
                recentCount={recentMagnets.length}
                onOpenRecent={() => setIsMagnetsOpen(true)}
                mode={dashboardMode}
                onModeChange={setDashboardMode}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
              />

              {/* When Search Torrents is selected, render the mirror movies right here, same page as Top Releases */}
              {dashboardMode === 'search' ? (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <MirrorMoviesView 
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onAddMagnet={handleAddMagnet}
                    onAddToQueue={handleAddToQueue}
                    onShowToast={(msg, type) => showToast(msg, type)}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />

                  {results.length > 0 && (
                    <div className="pt-8 border-t border-[#1E293B] space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-200">Additional Public Indexer Results</h3>
                        <p className="text-xs text-slate-400">Torrents found from 1337x, ThePirateBay, and YTS</p>
                      </div>
                      <SearchResults 
                        results={results} 
                        onDownload={handleAddMagnet} 
                        onAddToQueue={handleAddToQueue}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Storage Capacity Card */}
                  <StorageCard 
                    storage={storage} 
                    onClickDetails={() => setCurrentTab('storage')}
                  />

                  {searchError && (
                    <div className="bg-red-950/40 border border-red-800 text-red-400 p-4 rounded-2xl mb-6 text-sm">
                      {searchError}
                    </div>
                  )}

                  {/* Torrent Search Results */}
                  {results.length > 0 && (
                    <SearchResults 
                      results={results} 
                      onDownload={handleAddMagnet} 
                      onAddToQueue={handleAddToQueue}
                    />
                  )}

                  {/* Active Cloud Downloads in Seedr */}
                  <ActiveDownloads 
                    transfers={activeTransfers} 
                    onCancel={(id, type) => handleDelete(id, type || 'torrent')}
                  />

                  {/* Upcoming Download Schedule / Queue Manager */}
                  <QueueManager 
                    queue={queue}
                    isAutoEnabled={isAutoEnabled}
                    onMoveItem={moveItem}
                    onRemoveItem={removeFromQueue}
                    onClearQueue={clearQueue}
                    onToggleAuto={toggleAutoQueue}
                    onSendNow={handleSendFromQueueNow}
                  />

                  {/* Completed Files in Seedr Cloud */}
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
                </>
              )}
            </>
          )}

          {currentTab === 'queue' && (
            <div className="space-y-5">
              {/* Active Cloud Downloads if any torrent is currently downloading in Seedr */}
              {activeTransfers.length > 0 && (
                <ActiveDownloads transfers={activeTransfers} onCancel={handleCancelTransfer} />
              )}

              {/* Input for pasting or adding magnet links to the upcoming queue */}
              <SearchBar 
                onSearch={handleSearch} 
                onAddMagnet={handleAddMagnet} 
                onAddToQueue={handleAddToQueue}
                loading={searchLoading} 
                queueCount={queue.length}
                recentCount={recentMagnets.length}
                onOpenRecent={() => setIsMagnetsOpen(true)}
                isQueueTab={true}
              />

              {/* Upcoming Download Queue List (Always visible) */}
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

              {results.length > 0 && (
                <SearchResults 
                  results={results} 
                  onDownload={handleAddMagnet} 
                  onAddToQueue={handleAddToQueue}
                />
              )}
            </div>
          )}

          {currentTab === 'storage' && (
            <div className="space-y-6 max-w-3xl">
              <div className="pb-3 border-b border-[#1E293B]">
                <h2 className="text-lg sm:text-xl font-bold text-white">Seedr Cloud Storage Details</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Overview of your account storage quota and cloud allocation.
                </p>
              </div>

              <StorageCard storage={storage} />

              <div className="bg-[#111927] p-5 sm:p-6 rounded-2xl border border-[#1E293B] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#00DF81]/10 text-[#00DF81] rounded-xl border border-[#00DF81]/20">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white">Free Tier Account</h4>
                      <p className="text-xs text-slate-400">Total capacity: {formatBytes(max)}</p>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#00DF81] font-mono">
                    {formatBytes(used)} Used
                  </span>
                </div>

                <div className="pt-4 border-t border-[#1E293B] flex items-center justify-between">
                  <span className="text-xs text-slate-400">Want more than 4.5 GB?</span>
                  <a
                    href="https://www.seedr.cc/premium"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#00DF81] hover:underline"
                  >
                    <span>Upgrade on Seedr.cc</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

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
            </div>
          )}

          {currentTab === 'recent' && (
            <RecentLinksView 
              magnets={recentMagnets}
              onRemove={removeManualMagnet}
              onClearAll={clearRecentMagnets}
              onRetry={(magnet, name) => handleAddMagnet(magnet, name)}
              onSearch={handleSearch}
              onAddMagnet={handleAddMagnet}
              onAddToQueue={handleAddToQueue}
              searchLoading={searchLoading}
            />
          )}

          {currentTab === 'discover' && (
            <MirrorMoviesView 
              onAddMagnet={handleAddMagnet}
              onAddToQueue={handleAddToQueue}
              onShowToast={(msg, type) => showToast(msg, type)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </main>
      </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <BottomNav 
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenRecent={() => setIsMagnetsOpen(true)}
        telegramUrl={telegramUrl}
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
        onAddToQueue={handleAddToQueue}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onShowToast={(msg, type) => showToast(msg, type)}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-4 max-w-sm sm:max-w-md">
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
