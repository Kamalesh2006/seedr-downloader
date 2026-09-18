import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Link as LinkIcon, 
  Loader2, 
  History, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  X,
  Flame,
  Plus,
  CloudDownload,
  Zap
} from 'lucide-react';
import api from '../api/client';
import { extractMagnetName, isValidMagnet } from '../utils/magnet';

export default function SearchBar({ 
  onSearch, 
  onAddMagnet, 
  loading,
  recentCount = 0,
  queueCount = 0,
  onOpenRecent,
  prefilledMagnet = null,
  prefilledName = null,
  isQueueTab = false,
  mode: propMode,
  onModeChange,
  searchQuery = '',
  onSearchQueryChange
}) {
  const [internalMode, setInternalMode] = useState('magnet'); // 'magnet' is first and default
  const mode = propMode !== undefined ? propMode : internalMode;
  const setMode = (m) => {
    setInternalMode(m);
    onModeChange?.(m);
  };

  const [internalQuery, setInternalQuery] = useState('');
  const query = searchQuery !== undefined && searchQuery !== '' ? searchQuery : internalQuery;
  const setQuery = (q) => {
    setInternalQuery(q);
    onSearchQueryChange?.(q);
  };

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

  // Auto-detect if user pastes magnet in search input
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim().toLowerCase().startsWith('magnet:?')) {
      setMode('magnet');
      setMagnet(val);
      setQuery('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((isQueueTab || mode === 'magnet') && magnet.trim()) {
      const finalName = customName.trim() || detectedName || 'Magnet Download';
      onAddMagnet(magnet.trim(), finalName);
      setMagnet('');
      setCustomName('');
      setDetectedName('');
    } else if (!isQueueTab && mode === 'search' && query.trim()) {
      if (query.trim().toLowerCase().startsWith('magnet:?')) {
        setMode('magnet');
        setMagnet(query.trim());
        setQuery('');
      } else {
        onSearch(query.trim());
      }
    }
  };

  const handleSelectTopRelease = (movie) => {
    const term = movie.title || '';
    setQuery(term);
    onSearch(term);
  };

  const handleClear = () => {
    setMagnet('');
    setQuery('');
    setCustomName('');
    setDetectedName('');
  };

  return (
    <div className={`bg-[#111927] border border-[#1E293B] rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-black/20 mb-5 sm:mb-6 ${isQueueTab ? 'mb-0' : ''}`}>
      {/* Top Mode Switcher Tabs: Paste Magnet comes FIRST, Search Torrents comes SECOND */}
      <div className={`${isQueueTab ? 'hidden' : 'grid'} grid-cols-2 gap-2 bg-[#090F1C] p-1 rounded-xl border border-[#1E293B] mb-3 sm:mb-4 select-none`}>
        <button
          type="button"
          onClick={() => setMode('magnet')}
          className={`w-full py-2 sm:py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === 'magnet'
              ? 'bg-[#00DF81] text-[#071911] font-bold shadow-md shadow-emerald-500/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Paste Torrent / Magnet</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('search')}
          className={`w-full py-2 sm:py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === 'search'
              ? 'bg-[#00DF81] text-[#071911] font-bold shadow-md shadow-emerald-500/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search Torrents</span>
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'magnet' ? (
          <div className="space-y-3">
            {/* Explainer card for converting torrent to direct download */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-[#0A1626]/70 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 sm:p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <Zap className="w-4 h-4 text-[#00DF81] shrink-0" />
                <span>Convert Torrent into Fast Direct Download</span>
              </div>
              <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed">
                Paste any torrent link or magnet URL below. Our cloud server fetches it at lightning speed, converting it into a <strong className="text-white">direct high-speed download link</strong> (compatible with IDM & browsers) and <strong className="text-white">instant web stream</strong> without using any torrent client.
              </p>
              <div className="pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] sm:text-[11px] text-slate-400 border-t border-[#1E293B]/70">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81]" />
                  <span>Cloud fetches files at server speed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81]" />
                  <span>Direct HTTPS Download (Browser / IDM)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81]" />
                  <span>Instant Streaming in Browser or VLC</span>
                </div>
              </div>
            </div>

            <div className="relative bg-[#090F1C] border border-[#1E293B] rounded-xl focus-within:border-[#00DF81] focus-within:ring-1 focus-within:ring-[#00DF81]/30 transition-all p-2.5 sm:p-3">
              <div className="flex items-start gap-2 sm:gap-2.5">
                <LinkIcon className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                <textarea
                  rows={isQueueTab ? 2 : 3}
                  value={magnet}
                  onChange={(e) => setMagnet(e.target.value)}
                  placeholder="Paste torrent or magnet link here (e.g. magnet:?xt=urn:btih:...)..."
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm p-1 sm:p-2 focus:outline-none resize-none font-mono"
                  disabled={loading}
                  autoFocus
                />
                {magnet && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Extracted File Name Preview */}
            {magnet.trim() && (
              <div className="bg-[#090F1C]/90 border border-[#1E293B] rounded-xl p-3.5 animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#00DF81]">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Detected File Name</span>
                  </div>
                  {isValidMagnet(magnet) && (
                    <span className="text-[11px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Valid Magnet
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-[#141D2E] rounded-lg px-3 py-2 border border-[#1E293B] focus-within:border-[#00DF81]">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Torrent or file name..."
                    className="w-full bg-transparent text-xs sm:text-sm text-slate-100 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-500 hidden sm:block">
                Auto-schedules in queue if storage is full (Max 4.5 GB)
              </div>
              
              <div className="w-full sm:w-auto flex items-center gap-2 sm:gap-2.5 sm:ml-auto">
                <button
                  type="submit"
                  disabled={loading || !magnet.trim()}
                  className="w-full sm:w-auto bg-[#00DF81] hover:bg-[#05D686] text-[#071911] font-bold px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 min-w-0 sm:min-w-[140px] disabled:opacity-40 shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CloudDownload className="w-4 h-4 shrink-0" />
                      <span>Add to Cloud</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1 bg-[#090F1C] border border-[#1E293B] rounded-xl flex items-center focus-within:border-[#00DF81] focus-within:ring-1 focus-within:ring-[#00DF81]/30 transition-all overflow-hidden">
                <Search className="w-5 h-5 text-slate-400 ml-3.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Search movies, TV series, anime, regional releases..."
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-sm sm:text-base px-3 py-3 sm:py-3.5 focus:outline-none"
                  value={query}
                  onChange={handleQueryChange}
                  disabled={loading}
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 text-slate-400 hover:text-slate-200 mr-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="bg-[#00DF81] hover:bg-[#05D686] text-[#071911] font-bold px-5 sm:px-6 py-3 rounded-xl transition-all flex items-center justify-center min-w-[80px] sm:min-w-[100px] disabled:opacity-40 shadow-md shadow-emerald-500/20 active:scale-95 text-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
              </button>
            </div>

            {/* Quick Popular Suggestions */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
              <span className="text-slate-400 text-[11px] font-semibold">Popular:</span>
              {['Inception', 'Avatar', 'Interstellar', 'Spider-Man', 'Oppenheimer', 'Deadpool', 'Batman'].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    onSearch?.(term);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs bg-[#090F1C] text-slate-300 hover:text-[#00DF81] hover:bg-slate-800/80 border border-[#1E293B] hover:border-[#00DF81]/40 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
