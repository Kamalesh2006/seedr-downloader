import React, { useState } from 'react';
import { CloudRain, Send } from 'lucide-react';
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
    addToQueue,
    removeFromQueue,
    moveItem,
    clearQueue,
    toggleAutoQueue
  } = useQueue();
  
  const [toast, setToast] = useState(null);
  const [isMagnetsOpen, setIsMagnetsOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSearch = (query) => {
    search(query);
  };

  const handleAddMagnet = async (magnet, name = '') => {
    try {
      await addMagnet(magnet, name);
      showToast('Added to Seedr. Polling progress...', 'success');
      if (!name) {
        setIsMagnetsOpen(true);
      }
    } catch (err) {
      showToast('Failed to add to Seedr', 'error');
    }
  };

  const handleAddToQueue = async (magnet, name = '', size = null) => {
    try {
      await addToQueue(magnet, name, size);
      showToast(`Added "${name || 'Torrent'}" to upcoming schedule!`, 'success');
    } catch (err) {
      showToast('Failed to schedule in queue', 'error');
    }
  };

  const handleSendFromQueueNow = async (magnet, name, queueId) => {
    try {
      await addMagnet(magnet, name);
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
        showToast('Folder deleted from Seedr (Checking queue...)');
      } else if (type === 'torrent') {
        await deleteTorrent(id);
        showToast('Active torrent cancelled & removed from Seedr (Checking queue...)');
      } else if (type === 'task') {
        await deleteTask(id);
        showToast('Task removed from Seedr');
      } else {
        await deleteFile(id, parentFolderId);
        showToast('File deleted from Seedr (Checking queue...)');
      }
    } catch (err) {
      showToast(`Failed to delete ${type}`, 'error');
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-emerald-500/30">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
              <CloudRain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Seedr Downloader
              </h1>
              <p className="text-sm text-gray-500">Search, Schedule & Download Torrents instantly</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsTelegramOpen(true)}
              className="bg-gray-900 hover:bg-gray-800 border border-sky-900/50 hover:border-sky-700/60 text-sky-400 hover:text-sky-300 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-md group"
              title="Telegram Bot Integration"
            >
              <Send className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Telegram Bot</span>
            </button>
            <button
              onClick={() => setIsMagnetsOpen(true)}
              className="relative bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 group shadow-md"
            >
              <span>Pasted Magnets</span>
              {recentMagnets.some(m => m.status !== 'finished' && m.status !== 'failed') && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Search & Magnet Bar */}
        <SearchBar 
          onSearch={handleSearch} 
          onAddMagnet={handleAddMagnet} 
          onAddToQueue={handleAddToQueue}
          loading={searchLoading} 
          queueCount={queue.length}
          recentCount={recentMagnets.length}
          onOpenRecent={() => setIsMagnetsOpen(true)}
        />

        {searchError && (
          <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl mb-8">
            {searchError}
          </div>
        )}

        {/* Results */}
        <SearchResults 
          results={results} 
          onDownload={handleAddMagnet} 
          onAddToQueue={handleAddToQueue}
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
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className={`px-6 py-3 rounded-lg shadow-xl font-medium ${
            toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
          }`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
