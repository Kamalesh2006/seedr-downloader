import React, { useState } from 'react';
import { CloudDownload, ArrowDown, ArrowUp, ListOrdered, Check, AlertOctagon } from 'lucide-react';
import { isOversizedForSeedr } from '../utils/magnet';

export default function SearchResults({ results, onDownload, onAddToQueue }) {
  const [queuedIds, setQueuedIds] = useState(new Set());

  if (!results || results.length === 0) return null;

  const getSizeColor = (sizeStr) => {
    if (!sizeStr) return 'text-gray-400';
    if (isOversizedForSeedr(sizeStr)) return 'text-rose-400 font-bold';
    const sizeMatch = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
    if (!sizeMatch) return 'text-gray-400';
    
    const size = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    
    let sizeInGB = 0;
    if (unit === 'GB') sizeInGB = size;
    else if (unit === 'MB') sizeInGB = size / 1024;
    else if (unit === 'KB') sizeInGB = size / (1024 * 1024);
    
    if (sizeInGB < 2) return 'text-emerald-400 font-semibold';
    if (sizeInGB <= 4.5) return 'text-amber-400 font-semibold';
    return 'text-rose-400 font-semibold';
  };

  const handleQueue = async (result, idx) => {
    if (!onAddToQueue) return;
    try {
      await onAddToQueue(result.magnet, result.title, result.size);
      setQueuedIds(prev => new Set(prev).add(idx));
      setTimeout(() => {
        setQueuedIds(prev => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }, 3000);
    } catch (e) {
      console.error('Failed to queue', e);
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-hidden mb-8 border border-gray-800">
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/70 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-100">Search Results</h3>
          <p className="text-xs text-gray-400">Found {results.length} torrents matching your query (Max 4.5 GB limit)</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800/40 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="px-6 py-3.5 font-semibold">Name & Provider</th>
              <th className="px-6 py-3.5 font-semibold w-36">Size</th>
              <th className="px-6 py-3.5 font-semibold w-24">Seeders</th>
              <th className="px-6 py-3.5 font-semibold w-24">Leechers</th>
              <th className="px-6 py-3.5 font-semibold w-48 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {results.map((result, idx) => {
              const isQueued = queuedIds.has(idx);
              const isOversized = isOversizedForSeedr(result.size);

              return (
                <tr key={idx} className={`transition-colors group ${isOversized ? 'bg-red-950/10 hover:bg-red-950/20' : 'hover:bg-gray-800/40'}`}>
                  <td className="px-6 py-4">
                    <div className="text-gray-100 font-medium text-sm line-clamp-2 group-hover:text-emerald-300 transition-colors" title={result.title}>
                      {result.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
                        {result.provider}
                      </span>
                      {result.time && (
                        <span className="text-[11px] text-gray-500">
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
                    <div className="inline-flex items-center gap-2">
                      {onAddToQueue && (
                        <button
                          onClick={() => handleQueue(result, idx)}
                          disabled={isQueued || isOversized}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isOversized
                              ? 'opacity-40 cursor-not-allowed bg-gray-800 border-gray-700 text-gray-500'
                              : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]'
                          }`}
                          title={isOversized ? 'File size exceeds Seedr 4.5 GB limit' : 'Schedule in queue for later'}
                        >
                          {isQueued ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ListOrdered className="w-3.5 h-3.5" />}
                          <span>{isQueued ? 'Queued' : '+ Queue'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => onDownload(result.magnet, result.title, result.size)}
                        disabled={isOversized}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-md ${
                          isOversized
                            ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500 border border-gray-700'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                        title={isOversized ? 'File size exceeds Seedr 4.5 GB limit' : 'Send to Seedr'}
                      >
                        <CloudDownload className="w-4 h-4" />
                        <span>Seedr</span>
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
