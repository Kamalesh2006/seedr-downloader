import React from 'react';
import { CloudDownload, ArrowDown, ArrowUp, AlertOctagon, Plus } from 'lucide-react';
import { isOversizedForSeedr } from '../utils/magnet';

export default function SearchResults({ results, onDownload, onAddToQueue }) {
  if (!results || results.length === 0) return null;

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
    <div className="bg-[#111927] rounded-2xl shadow-lg shadow-black/20 overflow-hidden mb-6 border border-[#1E293B]">
      <div className="px-5 py-4 border-b border-[#1E293B] bg-[#111927] flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white">Search Results</h3>
          <p className="text-xs text-slate-400">Found {results.length} torrents (Max 4.5 GB total storage limit)</p>
        </div>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="md:hidden divide-y divide-[#1E293B]/60">
        {results.map((result, idx) => {
          const isOversized = isOversizedForSeedr(result.size);

          return (
            <div key={`m-${idx}`} className={`p-4 transition-colors ${isOversized ? 'bg-red-950/10' : 'hover:bg-[#152033]'}`}>
              <div className="text-slate-100 font-semibold text-xs sm:text-sm line-clamp-2 mb-2" title={result.title}>
                {result.title}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#090F1C] text-slate-400 font-mono border border-[#1E293B]">
                    {result.provider}
                  </span>
                  <span className={`text-xs font-mono ${getSizeColor(result.size)}`}>
                    {result.size}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#00DF81]/10 text-[#00DF81] border border-[#00DF81]/20">
                    <ArrowUp className="w-3 h-3" />
                    {result.seeds || 0}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <ArrowDown className="w-3 h-3" />
                    {result.leeches || 0}
                  </span>
                </div>
              </div>

              {isOversized && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 mb-2">
                  <AlertOctagon className="w-3 h-3" /> Exceeds 4.5 GB Seedr Limit
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {onAddToQueue && (
                  <button
                    onClick={() => onAddToQueue(result.magnet, result.title, result.size)}
                    disabled={isOversized}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-center disabled:opacity-40"
                  >
                    Schedule
                  </button>
                )}

                <button
                  onClick={() => onDownload(result.magnet, result.title, result.size)}
                  disabled={isOversized}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                    isOversized
                      ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700'
                      : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-md shadow-emerald-500/20'
                  }`}
                >
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>Add to Seedr</span>
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
            <tr className="bg-[#090F1C] text-slate-400 text-xs uppercase tracking-wider border-b border-[#1E293B]">
              <th className="px-6 py-3.5 font-semibold">Name & Provider</th>
              <th className="px-6 py-3.5 font-semibold w-32">Size</th>
              <th className="px-6 py-3.5 font-semibold w-24">Seeders</th>
              <th className="px-6 py-3.5 font-semibold w-24">Leechers</th>
              <th className="px-6 py-3.5 font-semibold w-48 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]/60">
            {results.map((result, idx) => {
              const isOversized = isOversizedForSeedr(result.size);

              return (
                <tr key={`d-${idx}`} className={`transition-colors group ${isOversized ? 'bg-red-950/10 hover:bg-red-950/20' : 'hover:bg-[#152033]'}`}>
                  <td className="px-6 py-4">
                    <div className="text-slate-100 font-medium text-sm line-clamp-2 group-hover:text-[#00DF81] transition-colors" title={result.title}>
                      {result.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#090F1C] text-slate-400 font-mono border border-[#1E293B]">
                        {result.provider}
                      </span>
                      {result.time && (
                        <span className="text-[11px] text-slate-500">
                          {result.time}
                        </span>
                      )}
                      {isOversized && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#00DF81]/10 text-[#00DF81] border border-[#00DF81]/20">
                      <ArrowUp className="w-3 h-3" />
                      {result.seeds || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <ArrowDown className="w-3 h-3" />
                      {result.leeches || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onAddToQueue && (
                        <button
                          onClick={() => onAddToQueue(result.magnet, result.title, result.size)}
                          disabled={isOversized}
                          className="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all disabled:opacity-40"
                          title="Schedule in queue"
                        >
                          Schedule
                        </button>
                      )}
                      <button
                        onClick={() => onDownload(result.magnet, result.title, result.size)}
                        disabled={isOversized}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                          isOversized
                            ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700'
                            : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                        title={isOversized ? 'Exceeds limit' : 'Add to Seedr'}
                      >
                        <CloudDownload className="w-3.5 h-3.5" />
                        <span>Add</span>
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
