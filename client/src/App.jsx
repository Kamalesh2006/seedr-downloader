import React, { useState } from 'react';
import { 
  CloudRain, 
  Send, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle,
  HardDrive,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import ActiveDownloads from './components/ActiveDownloads';
import CompletedFiles from './components/CompletedFiles';
import QueueManager from './components/QueueManager';
import RecentMagnetsModal from './components/RecentMagnetsModal';
import TelegramModal from './components/TelegramModal';
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
    removeManualMagnet
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMagnetsOpen, setIsMagnetsOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

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
        showToast(`Seedr is currently occupied. "${name || 'Torrent'}" automatically scheduled in Upcoming Queue! (Will start when space is freed)`, 'info');
        fetchQueue();
      } else {
        showToast('Added to Seedr. Polling progress...', 'success');
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
      if (type === 'folder') {
        await deleteFolder(id);
        showToast('Folder deleted from Seedr (Checking queue for next download...)');
      } else if (type === 'torrent') {
        await deleteTorrent(id);
        showToast('Active torrent cancelled & removed from Seedr (Checking queue...)');
      } else if (type === 'task') {
        await deleteTask(id);
        showToast('Task removed from Seedr');
      } else {
        await deleteFile(id, parentFolderId);
        showToast('File deleted from Seedr (Checking queue for next download...)');
      }
      fetchQueue();
    } catch (err) {
      showToast(`Failed to delete ${type}`, 'error');
      throw err;
    }
  };

  const getToastStyles = (type) => {
    switch (type) {
      case 'error':
        return 'bg-red-950 border border-red-800 text-red-200 shadow-red-950/50';
      case 'info':
        return 'bg-indigo-950 border border-indigo-800 text-indigo-200 shadow-indigo-950/50';
      case 'warning':
        return 'bg-amber-950 border border-amber-800 text-amber-200 shadow-amber-950/50';
      default:
        return 'bg-emerald-950 border border-emerald-800 text-emerald-200 shadow-emerald-950/50';
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
        return <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
  };

  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024);
  const usedPercentage = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#0B111E] text-gray-100 font-sans flex antialiased selection:bg-emerald-500/30">
      
      {/* Desktop Left Sidebar */}
      <div className="hidden md:block">
        <Sidebar 
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          storage={storage}
          queueCount={queue.length}
          recentCount={recentMagnets.length}
          onOpenTelegram={() => setIsTelegramOpen(true)}
          onOpenRecent={() => setIsMagnetsOpen(true)}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="w-64 h-full bg-[#070D18] border-r border-slate-800 animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar 
              currentTab={currentTab}
              setCurrentTab={(tab) => {
                setCurrentTab(tab);
                setIsMobileMenuOpen(false);
              }}
              storage={storage}
              queueCount={queue.length}
              recentCount={recentMagnets.length}
              onOpenTelegram={() => {
                setIsTelegramOpen(true);
                setIsMobileMenuOpen(false);
              }}
              onOpenRecent={() => {
                setIsMagnetsOpen(true);
                setIsMobileMenuOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#0B111E]">
        {/* Top Navbar */}
        <Navbar 
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenRecent={() => setIsMagnetsOpen(true)}
          onOpenTelegram={() => setIsTelegramOpen(true)}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          queueCount={queue.length}
        />

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <>
              {/* Search & Magnet Bar */}
              <SearchBar 
                onSearch={handleSearch} 
                onAddMagnet={handleAddMagnet} 
                loading={searchLoading} 
                queueCount={queue.length}
                recentCount={recentMagnets.length}
                onOpenRecent={() => setIsMagnetsOpen(true)}
              />

              {searchError && (
                <div className="bg-red-950/40 border border-red-800 text-red-400 p-4 rounded-2xl mb-8">
                  {searchError}
                </div>
              )}

              {/* Results */}
              <SearchResults 
                results={results} 
                onDownload={handleAddMagnet} 
              />

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

              {/* Completed Files & Seedr Storage Manager */}
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

          {currentTab === 'queue' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-gray-100">Upcoming Download Queue</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Order-wise automated scheduler (FIFO). As soon as storage is freed, the next torrent automatically starts.
                  </p>
                </div>
              </div>

              <QueueManager 
                queue={queue}
                isAutoEnabled={isAutoEnabled}
                onMoveItem={moveItem}
                onRemoveItem={removeFromQueue}
                onClearQueue={clearQueue}
                onToggleAuto={toggleAutoQueue}
                onSendNow={handleSendFromQueueNow}
              />

              {/* Search Bar for quickly adding to queue */}
              <SearchBar 
                onSearch={handleSearch} 
                onAddMagnet={handleAddMagnet} 
                loading={searchLoading} 
                queueCount={queue.length}
                recentCount={recentMagnets.length}
                onOpenRecent={() => setIsMagnetsOpen(true)}
              />

              <SearchResults 
                results={results} 
                onDownload={handleAddMagnet} 
              />
            </div>
          )}

          {currentTab === 'storage' && (
            <div className="space-y-6 max-w-3xl">
              <div className="pb-4 border-b border-slate-800">
                <h2 className="text-xl font-bold text-gray-100">Seedr Cloud Storage Details</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Overview of your account storage quota and cloud allocation.
                </p>
              </div>

              <div className="bg-[#0E1626] p-6 rounded-2xl border border-slate-800/80 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-100">Free Tier Account</h4>
                      <p className="text-xs text-gray-400">Total capacity: {formatBytes(max)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {formatBytes(used)} Used
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Used: {usedPercentage}%</span>
                    <span>Free: {formatBytes(Math.max(0, max - used))}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                      style={{ width: `${usedPercentage}%` }}
                    />
                  </div>
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
        </main>
      </div>

      {/* Telegram Bot Modal */}
      <TelegramModal 
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />

      {/* Recent / Manual Magnets Converter Modal */}
      <RecentMagnetsModal 
        isOpen={isMagnetsOpen}
        onClose={() => setIsMagnetsOpen(false)}
        magnets={recentMagnets}
        onRemove={removeManualMagnet}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 max-w-md">
          <div className={`px-5 py-3.5 rounded-xl shadow-2xl font-medium flex items-center gap-3 text-xs sm:text-sm ${getToastStyles(toast.type)}`}>
            {getToastIcon(toast.type)}
            <span className="flex-1">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
