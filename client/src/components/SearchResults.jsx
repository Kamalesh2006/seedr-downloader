import React from 'react';
import { CloudDownload } from 'lucide-react';

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
    
    if (sizeInGB < 2) return 'text-green-400';
    if (sizeInGB < 4) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden mb-8 border border-gray-800">
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
        <h3 className="text-lg font-semibold text-gray-100">Search Results</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800/50 text-gray-400 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium w-32">Size</th>
              <th className="px-6 py-4 font-medium w-24">Seeders</th>
              <th className="px-6 py-4 font-medium w-24">Leechers</th>
              <th className="px-6 py-4 font-medium w-32 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {results.map((result, idx) => (
              <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-gray-200 font-medium line-clamp-2" title={result.title}>
                    {result.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{result.provider}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`font-medium ${getSizeColor(result.size)}`}>
                    {result.size}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400">
                    {result.seeds || 0}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400">
                    {result.leeches || 0}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => onDownload(result.magnet, result.title)}
                    className="inline-flex items-center gap-2 bg-gray-800 hover:bg-emerald-600 text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-colors group"
                    title="Download via Seedr"
                  >
                    <CloudDownload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Seedr</span>
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
