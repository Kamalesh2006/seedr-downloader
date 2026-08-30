import React, { useState } from 'react';
import { CloudRain } from 'lucide-react';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import ActiveDownloads from './components/ActiveDownloads';
import CompletedFiles from './components/CompletedFiles';
import useSearch from './hooks/useSearch';
import useSeedr from './hooks/useSeedr';

function App() {
  const { search, results, loading: searchLoading, error: searchError } = useSearch();
  const { 
    activeTransfers, 
    completedFiles, 
    addMagnet, 
    getDownloadUrl, 
    deleteFile, 
    deleteFolder 
  } = useSeedr();
  
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSearch = (query) => {
    search(query);
  };

  const handleAddMagnet = async (magnet, name = '') => {
    try {
      await addMagnet(magnet, name);
      showToast('Added to Seedr successfully');
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
        <header className="flex items-center gap-3 mb-10">
          <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
            <CloudRain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Seedr Downloader
            </h1>
            <p className="text-sm text-gray-500">Search & Download Torrents instantly</p>
          </div>
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
