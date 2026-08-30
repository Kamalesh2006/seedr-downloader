import React from 'react';
import { CloudDownload, Users, Download, ArrowDown, ArrowUp } from 'lucide-react';

export default function SearchResults({ results, onDownload }) {
  if (!results || results.length === 0) return null;

  const getSizeColor = (sizeStr) => {
    if (!sizeStr) return 'text-gray-400';
    const sizeMatch = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
    if (!sizeMatch) return 'text-gray-400';
    
    const size = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    
    let sizeInGB = 0;
    if (unit === 'GB') sizeInGB = size;
    else if (unit === 'MB') sizeInGB = size / 1024;
    else if (unit === 'KB') sizeInGB = size / (1024 * 1024);
    
    if (sizeInGB < 2) return 'text-emerald-400 font-semibold';
    if (sizeInGB < 4) return 'text-amber-400 font-semibold';
    return 'text-rose-400 font-semibold';
  };

  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-hidden mb-8 border border-gray-800">
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/70 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-100">Search Results</h3>
          <p className="text-xs text-gray-400">Found {results.length} torrents matching your query</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800/40 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="px-6 py-3.5 font-semibold">Name & Provider</th>
              <th className="px-6 py-3.5 font-semibold w-32">Size</th>
              <th className="px-6 py-3.5 font-semibold w-24">Seeders</th>
              <th className="px-6 py-3.5 font-semibold w-24">Leechers</th>
              <th className="px-6 py-3.5 font-semibold w-32 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {results.map((result, idx) => (
              <tr key={idx} className="hover:bg-gray-800/40 transition-colors group">
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
                  <button
                    onClick={() => onDownload(result.magnet, result.title, result.size)}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]"
                    title="Send to Seedr"
                  >
                    <CloudDownload className="w-4 h-4" />
                    <span>Seedr</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
