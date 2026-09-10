import React, { useState } from 'react';
import { CloudDownload, ArrowDown, ArrowUp, AlertOctagon, Copy, Check } from 'lucide-react';
import { isOversizedForSeedr } from '../utils/magnet';

export default function SearchResults({ results, onDownload, onShowToast }) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!results || results.length === 0) return null;

  const handleCopyMagnet = async (magnet, key, e) => {
    e?.stopPropagation();
    if (!magnet) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(magnet);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = magnet;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      onShowToast?.('Magnet link copied to clipboard', 'success');
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy magnet:', err);
      onShowToast?.('Failed to copy magnet link', 'error');
    }
  };

  const getSizeColor = (sizeStr) => {
    if (!sizeStr) return 'text-slate-400';
    if (isOversizedForSeedr(sizeStr)) return 'text-rose-400 font-bold';
    const sizeMatch = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
    if (!sizeMatch) return 'text-slate-400';
    
    const size = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    
    let sizeInGB = 0;
    if (unit === 'GB') sizeInGB = size;
    else if (unit === 'MB') sizeInGB = size / 1024;
    else if (unit === 'KB') sizeInGB = size / (1024 * 1024);
    
    if (sizeInGB < 2) return 'text-[#00DF81] font-semibold';
    if (sizeInGB <= 4.5) return 'text-amber-400 font-semibold';
    return 'text-rose-400 font-semibold';
  };

  return (
    <div className="bg-white dark:bg-[#111927] rounded-2xl shadow-sm dark:shadow-lg dark:shadow-black/20 overflow-hidden mb-6 border border-slate-200 dark:border-[#1E293B]">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#111927] flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Search Results
            <span className="text-xs bg-emerald-50 dark:bg-[#090F1C] text-emerald-700 dark:text-[#00DF81] px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-[#1E293B]">
              {results.length} found
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Click "Add to Seedr" for cloud downloads (max 4.5 GB) or "Copy Magnet" for any torrent.
          </p>
        </div>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-[#1E293B]/60">
        {results.map((result, idx) => {
          const isOversized = isOversizedForSeedr(result.size);
          const isCopied = copiedKey === `m-${idx}`;

          return (
            <div key={`m-${idx}`} className={`p-4 space-y-2.5 ${isOversized ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                  {result.title}
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#090F1C] text-slate-600 dark:text-slate-400 font-mono border border-slate-200 dark:border-[#1E293B]">
                  {result.provider}
                </span>
                <span className={getSizeColor(result.size)}>
                  {result.size}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-[#00DF81]">
                    <ArrowUp className="w-3 h-3" /> {result.seeds || 0}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
                    <ArrowDown className="w-3 h-3" /> {result.leeches || 0}
                  </span>
                </div>
              </div>

              {isOversized && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 mb-2">
                  <AlertOctagon className="w-3 h-3" /> Exceeds 4.5 GB Seedr Limit
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onDownload(result.magnet, result.title, result.size)}
                  disabled={isOversized}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                    isOversized
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                      : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-md shadow-emerald-500/20 active:scale-95'
                  }`}
                  title={isOversized ? 'File exceeds Seedr 4.5 GB limit' : 'Add to Seedr (Auto-queues if full)'}
                >
                  <CloudDownload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Add to Seedr</span>
                </button>

                <button
                  onClick={(e) => handleCopyMagnet(result.magnet, `m-${idx}`, e)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 ${
                    isCopied
                      ? 'bg-emerald-500/25 text-emerald-700 dark:text-[#00DF81] border-emerald-500/40'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#090F1C] dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-[#1E293B]'
                  }`}
                  title="Copy magnet link"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00DF81] shrink-0" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Copy Magnet</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#090F1C] text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-[#1E293B]">
              <th className="px-6 py-3.5 font-semibold">Name & Provider</th>
              <th className="px-6 py-3.5 font-semibold w-32">Size</th>
              <th className="px-6 py-3.5 font-semibold w-24">Seeders</th>
              <th className="px-6 py-3.5 font-semibold w-24">Leechers</th>
              <th className="px-6 py-3.5 font-semibold w-60 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1E293B]/60">
            {results.map((result, idx) => {
              const isOversized = isOversizedForSeedr(result.size);
              const isCopied = copiedKey === `d-${idx}`;

              return (
                <tr key={`d-${idx}`} className={`transition-colors group ${isOversized ? 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-100/60 dark:hover:bg-red-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-[#152033]'}`}>
                  <td className="px-6 py-4">
                    <div className="text-slate-900 dark:text-slate-100 font-medium text-sm line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-[#00DF81] transition-colors" title={result.title}>
                      {result.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-[#090F1C] text-slate-600 dark:text-slate-400 font-mono border border-slate-200 dark:border-[#1E293B]">
                        {result.provider}
                      </span>
                      {result.time && (
                        <span className="text-[11px] text-slate-500">
                          {result.time}
                        </span>
                      )}
                      {isOversized && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <AlertOctagon className="w-3 h-3" /> Exceeds 4.5 GB Limit
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getSizeColor(result.size)}>
                      {result.size}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#00DF81]/10 text-emerald-600 dark:text-[#00DF81] border border-[#00DF81]/20">
                      <ArrowUp className="w-3 h-3" />
                      {result.seeds || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">
                      <ArrowDown className="w-3 h-3" />
                      {result.leeches || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onDownload(result.magnet, result.title, result.size)}
                        disabled={isOversized}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          isOversized
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                            : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                        title={isOversized ? 'File exceeds Seedr 4.5 GB limit' : 'Add to Seedr (Auto-queues if full)'}
                      >
                        <CloudDownload className="w-3.5 h-3.5" />
                        <span>Add to Seedr</span>
                      </button>

                      <button
                        onClick={(e) => handleCopyMagnet(result.magnet, `d-${idx}`, e)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                          isCopied
                            ? 'bg-emerald-500/25 text-emerald-700 dark:text-[#00DF81] border-emerald-500/40 shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#090F1C] dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-[#1E293B]'
                        }`}
                        title={isCopied ? 'Copied!' : 'Copy magnet link'}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00DF81]" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Magnet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
