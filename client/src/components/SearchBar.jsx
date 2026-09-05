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
  ListOrdered
} from 'lucide-react';
import { extractMagnetName, isValidMagnet } from '../utils/magnet';

export default function SearchBar({ 
  onSearch, 
  onAddMagnet, 
  onAddToQueue,
  loading,
  recentCount = 0,
  queueCount = 0,
  onOpenRecent,
  onOpenAceStream,
  prefilledMagnet = null,
  prefilledName = null
}) {
  const [mode, setMode] = useState('magnet'); // 'magnet' is first and default
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

  // Auto-detect if user pastes magnet or Ace Stream ID in search input
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim().toLowerCase().startsWith('magnet:?')) {
      setMode('magnet');
      setMagnet(val);
      setQuery('');
    }
  };

  const isAceStreamInput = (text) => {
    const trimmed = (text || '').trim();
    return trimmed.toLowerCase().startsWith('acestream://') || /^[a-fA-F0-9]{40}$/.test(trimmed);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const currentInput = mode === 'magnet' ? magnet.trim() : query.trim();

    // If an Ace Stream ID is submitted in either mode, route to Ace Stream player
    if (isAceStreamInput(currentInput) && onOpenAceStream) {
      onOpenAceStream(currentInput);
      setMagnet('');
      setQuery('');
      return;
    }

    if (mode === 'magnet' && magnet.trim()) {
      const finalName = customName.trim() || detectedName || 'Magnet Download';
      onAddMagnet(magnet.trim(), finalName);
      setMagnet('');
      setCustomName('');
      setDetectedName('');
    } else if (mode === 'search' && query.trim()) {
      if (query.trim().toLowerCase().startsWith('magnet:?')) {
        setMode('magnet');
        setMagnet(query.trim());
        setQuery('');
      } else {
        onSearch(query.trim());
      }
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
    setQuery('');
    setCustomName('');
    setDetectedName('');
  };

  return (
    <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 mb-6">
      {/* Top Mode Switcher Tabs: Paste Magnet comes FIRST, Search Torrents comes SECOND */}
      <div className="grid grid-cols-2 gap-2 bg-[#090F1C] p-1 rounded-xl border border-[#1E293B] mb-4 select-none">
        <button
          type="button"
          onClick={() => setMode('magnet')}
          className={`w-full py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === 'magnet'
              ? 'bg-[#00DF81] text-[#071911] font-bold shadow-md shadow-emerald-500/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Paste Magnet</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('search')}
          className={`w-full py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
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
            <div className="relative bg-[#090F1C] border border-[#1E293B] rounded-xl focus-within:border-[#00DF81] focus-within:ring-1 focus-within:ring-[#00DF81]/30 transition-all p-3">
              <div className="flex items-start gap-2.5">
                <LinkIcon className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                <textarea
                  placeholder="Paste magnet link (magnet:?xt=urn:btih:...)..."
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm font-mono focus:outline-none min-h-[85px] resize-y placeholder:font-sans"
                  value={magnet}
                  onChange={(e) => setMagnet(e.target.value)}
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
                Auto-schedules in queue if space is occupied (Max 4.5 GB)
              </div>
              
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={handleScheduleInQueue}
                  disabled={loading || !magnet.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all disabled:opacity-40 active:scale-95"
                  title="Schedule in upcoming download queue"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Schedule Queue</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || !magnet.trim()}
                  className="bg-[#00DF81] hover:bg-[#05D686] text-[#071911] font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center min-w-[130px] disabled:opacity-40 shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Seedr'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1 bg-[#090F1C] border border-[#1E293B] rounded-xl flex items-center focus-within:border-[#00DF81] focus-within:ring-1 focus-within:ring-[#00DF81]/30 transition-all overflow-hidden">
              <Search className="w-5 h-5 text-slate-400 ml-3.5 shrink-0" />
              <input
                type="text"
                placeholder="Search movies, TV series, anime, software..."
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
        )}
      </form>
    </div>
  );
}
