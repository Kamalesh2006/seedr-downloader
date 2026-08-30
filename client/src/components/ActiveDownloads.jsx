import React from 'react';
import { Activity } from 'lucide-react';

export default function ActiveDownloads({ transfers }) {
  if (!transfers || transfers.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg p-6 mb-8 border border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-emerald-500" />
        <h3 className="text-lg font-semibold text-gray-100">Active Downloads to Seedr</h3>
      </div>
      
      <div className="flex flex-col gap-4">
        {transfers.map(transfer => (
          <div key={transfer.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex justify-between items-start mb-2">
              <div className="text-gray-200 font-medium truncate pr-4">{transfer.name}</div>
              <div className="text-sm text-gray-400 whitespace-nowrap">
                {transfer.status === 'downloading' ? `Downloading ${transfer.progress}%` : transfer.status}
              </div>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 relative"
                style={{ width: `${transfer.progress || 0}%` }}
              >
                <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
