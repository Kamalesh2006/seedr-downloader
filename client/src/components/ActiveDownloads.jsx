import React from 'react';
import { Activity, Loader2, ArrowDownCircle } from 'lucide-react';

export default function ActiveDownloads({ transfers }) {
  if (!transfers || transfers.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl p-6 mb-8 border border-gray-800">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">Active Seedr Transfers</h3>
            <p className="text-xs text-gray-400">Downloading from peer swarm directly into Seedr cloud</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {transfers.length} Active
        </span>
      </div>
      
      <div className="flex flex-col gap-3.5">
        {transfers.map(transfer => (
          <div key={transfer.id} className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/60">
            <div className="flex justify-between items-start gap-4 mb-2.5">
              <div className="text-gray-100 font-semibold text-sm truncate flex-1" title={transfer.name}>
                {transfer.name}
              </div>
              <div className="text-xs font-semibold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{transfer.status === 'downloading' ? `${transfer.progress}%` : transfer.status}</span>
              </div>
            </div>
            
            <div className="w-full bg-gray-950/80 rounded-full h-2.5 overflow-hidden border border-gray-800">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 relative"
                style={{ width: `${Math.max(transfer.progress || 0, 3)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
