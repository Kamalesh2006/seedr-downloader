import React, { useState } from 'react';
import { CloudRain } from 'lucide-react';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import ActiveDownloads from './components/ActiveDownloads';
import CompletedFiles from './components/CompletedFiles';
import RecentMagnetsModal from './components/RecentMagnetsModal';
import useSearch from './hooks/useSearch';
import useSeedr from './hooks/useSeedr';

function App() {
  const { search, results, loading: searchLoading, error: searchError } = useSearch();
  const { 
    activeTransfers, 
    completedFiles, 
    recentMagnets,
    addMagnet, 
    getDownloadUrl, 
    deleteFile, 
    deleteFolder,
    removeManualMagnet
  } = useSeedr();
  
  const [toast, setToast] = useState(null);
  const [isMagnetsOpen, setIsMagnetsOpen] = useState(false);

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
      // If manual magnet was pasted, open the converter status modal
      if (!name) {
        setIsMagnetsOpen(true);
      }
    } catch (err) {
      showToast('Failed to add to Seedr', 'error');
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

  const handleDelete = async (id, type) => {
    try {
      if (type === 'folder') {
        await deleteFolder(id);
      } else {
        await deleteFile(id);
      }
      showToast(`${type} deleted`);
    } catch (err) {
      showToast(`Failed to delete ${type}`, 'error');
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
              <p className="text-sm text-gray-500">Search & Download Torrents instantly</p>
            </div>
          </div>
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
        </header>

        {/* Search */}
        <SearchBar 
          onSearch={handleSearch} 
          onAddMagnet={handleAddMagnet} 
          loading={searchLoading} 
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
        />

        {/* Active Downloads */}
        <ActiveDownloads transfers={activeTransfers} />

        {/* Completed Files */}
        <CompletedFiles 
          files={completedFiles} 
          onDownload={handleDownloadFile} 
          onDelete={handleDelete} 
        />

      </div>

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
