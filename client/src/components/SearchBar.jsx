import React, { useState, useEffect } from 'react';
import { Search, Link as LinkIcon, Loader2, History, FileText, CheckCircle2, Sparkles, X, ListOrdered } from 'lucide-react';
import { extractMagnetName, isValidMagnet, isOversizedForSeedr } from '../utils/magnet';

export default function SearchBar({ 
  onSearch, 
  onAddMagnet, 
  onAddToQueue,
  loading,
  recentCount = 0,
  queueCount = 0,
  onOpenRecent,
  prefilledMagnet = null,
  prefilledName = null
}) {
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [magnet, setMagnet] = useState('');
  const [customName, setCustomName] = useState('');
  const [detectedName, setDetectedName] = useState('');

  // Handle prefilled magnet link
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

  const handleScheduleInQueue = (e) => {
    e.preventDefault();
    if (!magnet.trim() || !onAddToQueue) return;
    const finalName = customName.trim() || detectedName || 'Scheduled Magnet';
    onAddToQueue(magnet.trim(), finalName);
    setMagnet('');
    setCustomName('');
    setDetectedName('');
  };

  const handleClear = () => {
    setMagnet('');
    setCustomName('');
    setDetectedName('');
  };

  return (
    <div className="bg-[#0E1626] p-6 rounded-2xl shadow-xl mb-8 border border-slate-800/80">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Mode Switcher Tabs */}
        <div className="flex items-center bg-[#070D18] p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              mode === 'search' 
                ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setMode('search')}
          >
            <Search className="w-4 h-4" />
            Search Torrents
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              mode === 'magnet' 
                ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setMode('magnet')}
          >
            <LinkIcon className="w-4 h-4" />
            Paste Magnet
          </button>
        </div>

        {/* Action Badges */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenRecent}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-gray-300 hover:text-white border border-slate-700/80 transition-all group"
            title="View recent magnet links"
          >
            <History className="w-4 h-4 text-emerald-400 group-hover:rotate-[-20deg] transition-transform" />
            <span>Recent Links</span>
            <span className="ml-0.5 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {recentCount}
            </span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        {mode === 'search' ? (
          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for movies, TV series, software, books..."
                className="w-full bg-[#070D18] text-gray-100 pl-11 pr-4 py-3.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-gray-500 text-sm md:text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-7 py-3.5 rounded-xl transition-all flex items-center justify-center min-w-[120px] disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99]"
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
                className="w-full bg-[#070D18] text-gray-100 pl-11 pr-10 py-3.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all min-h-[95px] resize-y text-sm font-mono placeholder:font-sans placeholder:text-gray-500"
                value={magnet}
                onChange={(e) => setMagnet(e.target.value)}
                disabled={loading}
              />
              {magnet && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-200 p-1 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Extracted File Name Preview & Editor */}
            {magnet.trim() && (
              <div className="bg-[#070D18]/90 border border-slate-800/80 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
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

                <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/60 focus-within:border-emerald-500">
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
                  You can edit the name above if you want to rename it before adding or scheduling.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-gray-500 hidden sm:block">
                Supports all standard BitTorrent magnet URIs (Max 4.5 GB)
              </div>
              
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={handleScheduleInQueue}
                  disabled={loading || !magnet.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:border-indigo-500 transition-all disabled:opacity-50 shadow-sm"
                  title="Add to upcoming queue (auto-downloads when storage frees)"
                >
                  <ListOrdered className="w-4 h-4 text-indigo-400" />
                  <span>Schedule in Queue</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || !magnet.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center min-w-[130px] disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Seedr'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
