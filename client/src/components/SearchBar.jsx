import React, { useState, useEffect, useRef } from 'react';
import { 
  Link as LinkIcon, 
  Loader2, 
  FileText, 
  Sparkles, 
  X,
  CloudDownload,
  Zap,
  Clipboard,
  CheckCircle2
} from 'lucide-react';
import { extractMagnetName, isValidMagnet, sanitizeAndExtractMagnet } from '../utils/magnet';

export default function SearchBar({ 
  onAddMagnet, 
  loading = false,
  prefilledMagnet = null,
  prefilledName = null,
  isQueueTab = false
}) {
  const [magnet, setMagnet] = useState('');
  const [customName, setCustomName] = useState('');
  const [detectedName, setDetectedName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);

  // Handle prefilled magnet link
  useEffect(() => {
    if (prefilledMagnet) {
      const clean = sanitizeAndExtractMagnet(prefilledMagnet);
      setMagnet(clean);
      const name = prefilledName || extractMagnetName(clean);
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

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const cleaned = sanitizeAndExtractMagnet(text);
          setMagnet(cleaned);
          const name = extractMagnetName(cleaned);
          setDetectedName(name);
          setCustomName(name);
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard read not permitted or failed:', err);
    }
    textareaRef.current?.focus();
  };

  const handlePaste = (e) => {
    try {
      const pasted = e.clipboardData?.getData('text');
      if (pasted) {
        const cleaned = sanitizeAndExtractMagnet(pasted);
        if (cleaned && cleaned !== pasted) {
          e.preventDefault();
          setMagnet(cleaned);
          const name = extractMagnetName(cleaned);
          setDetectedName(name);
          if (!customName || customName === detectedName) {
            setCustomName(name);
          }
        }
      }
    } catch (_) {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanMagnet = sanitizeAndExtractMagnet(magnet);
    if (!cleanMagnet) return;

    const finalName = customName.trim() || detectedName || extractMagnetName(cleanMagnet) || 'Magnet Download';
    setIsSubmitting(true);
    try {
      await onAddMagnet(cleanMagnet, finalName);
      setMagnet('');
      setCustomName('');
      setDetectedName('');
    } catch (err) {
      console.error('Failed to add magnet', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setMagnet('');
    setCustomName('');
    setDetectedName('');
    textareaRef.current?.focus();
  };

  const isBusy = loading || isSubmitting;
  const isInputValid = isValidMagnet(magnet);

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
              ref={textareaRef}
              rows={isQueueTab ? 2 : 3}
              value={magnet}
              onChange={(e) => setMagnet(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder="Paste torrent or magnet link here (e.g. magnet:?xt=urn:btih:...)..."
              className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm p-1 sm:p-2 focus:outline-none resize-none font-mono"
              disabled={isBusy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              autoFocus={!isQueueTab}
            />
            <div className="flex items-center gap-1 shrink-0">
              {/* Quick Paste from Clipboard Button */}
              {!magnet && (
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-[#00DF81] rounded-lg border border-emerald-200 dark:border-emerald-500/30 transition-colors shadow-sm active:scale-95 cursor-pointer"
                  title="Paste link from clipboard"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Paste</span>
                </button>
              )}
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
        </div>

        {/* Extracted File Name Preview */}
        {magnet.trim() && (
          <div className="bg-slate-50 dark:bg-[#090F1C]/90 border border-slate-200 dark:border-[#1E293B] rounded-xl p-3.5 animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-[#00DF81]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Detected File Name</span>
              </div>
              {isInputValid && (
                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
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
                disabled={isBusy}
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
              disabled={isBusy || !magnet.trim()}
              className="w-full sm:w-auto bg-[#00DF81] hover:bg-[#05D686] text-[#071911] font-bold px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 min-w-0 sm:min-w-[140px] disabled:opacity-40 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding...</span>
                </>
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
