import React, { useState } from 'react';
import { Search, Link as LinkIcon, Loader2 } from 'lucide-react';

export default function SearchBar({ onSearch, onAddMagnet, loading }) {
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [magnet, setMagnet] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'search' && query.trim()) {
      onSearch(query.trim());
    } else if (mode === 'magnet' && magnet.trim()) {
      onAddMagnet(magnet.trim());
      setMagnet('');
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl shadow-lg mb-8">
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'search' ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setMode('search')}
        >
          Search Torrents
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'magnet' ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setMode('magnet')}
        >
          Paste Magnet
        </button>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        {mode === 'search' ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for movies, software, etc..."
                className="w-full bg-gray-800 text-gray-100 pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center min-w-[120px] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <textarea
                placeholder="Paste your magnet link here..."
                className="w-full bg-gray-800 text-gray-100 pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all min-h-[100px] resize-y"
                value={magnet}
                onChange={(e) => setMagnet(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !magnet.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium transition-colors self-end flex items-center justify-center min-w-[140px] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add to Seedr'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
