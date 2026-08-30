import React, { useState, useEffect } from 'react';
import { Search, Link as LinkIcon, Loader2, History, FileText, CheckCircle2, Sparkles, X } from 'lucide-react';
import { extractMagnetName, isValidMagnet } from '../utils/magnet';

export default function SearchBar({ 
  onSearch, 
  onAddMagnet, 
  loading,
  recentCount = 0,
  onOpenRecent,
  prefilledMagnet = null,
  prefilledName = null
}) {
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [magnet, setMagnet] = useState('');
  const [customName, setCustomName] = useState('');
  const [detectedName, setDetectedName] = useState('');

  // Handle prefilled magnet link (e.g. when selected from Recent list)
  useEffect(() => {
    if (prefilledMagnet) {
      setMode('magnet');
      setMagnet(prefilledMagnet);
      const name = prefilledName || extractMagnetName(prefilledMagnet);
      setDetectedName(name);
      setCustomName(name);
    }
  }, [prefilledMagnet, prefilledName]);

  // Real-time file name extraction when magnet input changes
  useEffect(() => {
    if (magnet.trim()) {
      const extracted = extractMagnetName(magnet);
      setDetectedName(extracted);
      if (!customName || customName === detectedName) {
        setCustomName(extracted);
      }
    } else {
      setDetectedName('');
      setCustomName('');
    }
  }, [magnet]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'search' && query.trim()) {
      onSearch(query.trim());
    } else if (mode === 'magnet' && magnet.trim()) {
      const finalName = customName.trim() || detectedName || 'Magnet Download';
      onAddMagnet(magnet.trim(), finalName);
      setMagnet('');
      setCustomName('');
      setDetectedName('');
    }
  };

  const handleClear = () => {
    setMagnet('');
    setCustomName('');
    setDetectedName('');
  };

  return (
    <div className="bg-gray-900 p-6 rounded-2xl shadow-xl mb-8 border border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Mode Switcher Tabs */}
        <div className="flex items-center bg-gray-950/70 p-1 rounded-xl border border-gray-800">
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'search' 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
            onClick={() => setMode('search')}
          >
            <Search className="w-4 h-4" />
            Search Torrents
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'magnet' 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
            onClick={() => setMode('magnet')}
          >
            <LinkIcon className="w-4 h-4" />
            Paste Magnet
          </button>
        </div>

        {/* Show Recent Button */}
        <button
          type="button"
          onClick={onOpenRecent}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/60 hover:border-emerald-500/40 transition-all group"
          title="View recent magnet links"
        >
          <History className="w-4 h-4 text-emerald-400 group-hover:rotate-[-20deg] transition-transform" />
          <span>Recent Links</span>
          <span className="ml-0.5 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
            {recentCount}
          </span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        {mode === 'search' ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for movies, TV series, software, books..."
                className="w-full bg-gray-800/70 text-gray-100 pl-11 pr-4 py-3.5 rounded-xl border border-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-gray-500 text-sm md:text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center min-w-[120px] disabled:opacity-50 shadow-lg shadow-emerald-950/40 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <LinkIcon className="absolute left-3.5 top-3.5 text-gray-400 w-5 h-5" />
              <textarea
                placeholder="Paste magnet link (magnet:?xt=urn:btih:...)..."
                className="w-full bg-gray-800/70 text-gray-100 pl-11 pr-10 py-3.5 rounded-xl border border-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[95px] resize-y text-sm font-mono placeholder:font-sans placeholder:text-gray-500"
                value={magnet}
                onChange={(e) => setMagnet(e.target.value)}
                disabled={loading}
              />
              {magnet && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-200 p-1 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Extracted File Name Preview & Editor */}
            {magnet.trim() && (
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Detected File / Torrent Name</span>
                  </div>
                  {isValidMagnet(magnet) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Valid Magnet URI
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/60 focus-within:border-emerald-500">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Enter file or torrent name..."
                    className="w-full bg-transparent text-sm text-gray-100 focus:outline-none placeholder:text-gray-500 font-medium"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  You can edit the name above if you want to rename it before adding to Seedr.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-gray-500 hidden sm:block">
                Supports all standard BitTorrent magnet URIs
              </div>
              <button
                type="submit"
                disabled={loading || !magnet.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3 rounded-xl font-semibold transition-all self-end flex items-center justify-center min-w-[150px] disabled:opacity-50 shadow-lg shadow-emerald-950/40 hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add to Seedr'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
