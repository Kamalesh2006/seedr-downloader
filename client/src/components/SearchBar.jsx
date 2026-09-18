import React, { useState, useEffect } from 'react';
import { 
  Link as LinkIcon, 
  Loader2, 
  FileText, 
  Sparkles, 
  X,
  CloudDownload,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { extractMagnetName, isValidMagnet } from '../utils/magnet';

export default function SearchBar({ 
  onAddMagnet, 
  loading,
  prefilledMagnet = null,
  prefilledName = null,
  isQueueTab = false
}) {
  const [magnet, setMagnet] = useState('');
  const [customName, setCustomName] = useState('');
  const [detectedName, setDetectedName] = useState('');

  // Handle prefilled magnet link
  useEffect(() => {
    if (prefilledMagnet) {
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
    if (magnet.trim()) {
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
    <div className={`bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg dark:shadow-black/20 ${isQueueTab ? 'mb-0' : 'mt-2 mb-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-[#00DF81] flex items-center justify-center">
            <LinkIcon className="w-4 h-4" />
          </div>
          <span>Paste Torrent / Magnet Link</span>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
          High-Speed Direct Cloud Downloader
        </span>
      </div>

      {/* Step-by-Step Help Guide */}
      <div className="bg-emerald-50/70 dark:bg-emerald-500/[0.06] border border-emerald-200/80 dark:border-emerald-500/20 rounded-xl p-3 sm:p-3.5 mb-3.5">
        <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
          <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00DF81] shrink-0" />
          <span>How It Works (3 Easy Steps)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
          {/* Step 1 */}
          <div className="bg-white/90 dark:bg-[#090F1C]/90 border border-slate-200/80 dark:border-[#1E293B] rounded-xl p-2.5 sm:p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#00DF81] text-[#071911] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                1
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                Paste Link
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug pl-7">
              Copy any magnet URL or torrent hash and paste it in the box below.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white/90 dark:bg-[#090F1C]/90 border border-slate-200/80 dark:border-[#1E293B] rounded-xl p-2.5 sm:p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#00DF81] text-[#071911] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                2
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                Cloud Fetches It
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug pl-7">
              Seedr servers download the files silently to cloud storage in seconds.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white/90 dark:bg-[#090F1C]/90 border border-slate-200/80 dark:border-[#1E293B] rounded-xl p-2.5 sm:p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#00DF81] text-[#071911] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                3
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                Stream or Download
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug pl-7">
              Download at full ISP speed with IDM or stream videos right in browser/VLC.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Textarea Input for Magnet / Torrent link */}
        <div className="relative bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl focus-within:border-[#00DF81] focus-within:ring-1 focus-within:ring-[#00DF81]/30 transition-all p-2.5 sm:p-3">
          <div className="flex items-start gap-2 sm:gap-2.5">
            <LinkIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-1 shrink-0" />
            <textarea
              rows={isQueueTab ? 2 : 3}
              value={magnet}
              onChange={(e) => setMagnet(e.target.value)}
              placeholder="Paste torrent or magnet link here (e.g. magnet:?xt=urn:btih:...)..."
              className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm p-1 sm:p-2 focus:outline-none resize-none font-mono"
              disabled={loading}
              autoFocus={!isQueueTab}
            />
            {magnet && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear input"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Extracted File Name Preview */}
        {magnet.trim() && (
          <div className="bg-slate-50 dark:bg-[#090F1C]/90 border border-slate-200 dark:border-[#1E293B] rounded-xl p-3.5 animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-[#00DF81]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Detected File Name</span>
              </div>
              {isValidMagnet(magnet) && (
                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Valid Magnet
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-[#141D2E] rounded-lg px-3 py-2 border border-slate-200 dark:border-[#1E293B] focus-within:border-[#00DF81]">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Torrent or file name..."
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Auto-schedules in queue if storage is full (Max 4.5 GB)
          </div>
          
          <div className="w-full sm:w-auto flex items-center gap-2 sm:gap-2.5 sm:ml-auto">
            <button
              type="submit"
              disabled={loading || !magnet.trim()}
              className="w-full sm:w-auto bg-[#00DF81] hover:bg-[#05D686] text-[#071911] font-bold px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 min-w-0 sm:min-w-[140px] disabled:opacity-40 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
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
      </form>
    </div>
  );
}
