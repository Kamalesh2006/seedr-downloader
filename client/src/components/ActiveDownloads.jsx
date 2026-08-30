import React, { useState } from 'react';
import { Activity, Loader2, Trash2, Shield, Clock, AlertTriangle } from 'lucide-react';
import { formatBytes } from '../utils/magnet';

export default function ActiveDownloads({ transfers = [], onCancel }) {
  const [cancellingId, setCancellingId] = useState(null);

  if (!transfers || transfers.length === 0) return null;

  const handleCancel = async (id, type) => {
    if (!onCancel) return;
    setCancellingId(id);
    try {
      await onCancel(id, type);
    } catch (e) {
      console.error('Failed to cancel transfer', e);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl p-6 mb-8 border border-gray-800 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              Active Seedr Cloud Downloads
              <span className="text-xs font-normal text-gray-400">
                ({transfers.length})
              </span>
            </h3>
            <p className="text-xs text-gray-400">Torrents currently downloading or queuing in your Seedr account</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-800/80 border border-gray-700 text-[11px] text-gray-400">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Auto-cleans stalled torrents (2m idle / 1h max)</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-3.5">
        {transfers.map(transfer => {
          const isCancelling = cancellingId === transfer.id;
          const progress = transfer.progress || 0;
          const isStalledOrQueued = progress === 0;

          return (
            <div key={transfer.id} className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/60 transition-all hover:bg-gray-800/60">
              <div className="flex justify-between items-start gap-4 mb-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-gray-100 font-semibold text-sm truncate" title={transfer.name}>
                    {transfer.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-3">
                    {transfer.size > 0 && (
                      <span className="font-mono">{formatBytes(transfer.size)}</span>
                    )}
                    <span className={`font-medium ${isStalledOrQueued ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {transfer.status === 'downloading' 
                        ? (isStalledOrQueued ? 'Collecting Seeds / Queued' : `Downloading ${progress}%`) 
                        : transfer.status}
                    </span>
                    {isStalledOrQueued && (
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400/70" />
                        Auto-cancels if no progress for 2m
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-xs font-semibold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{progress}%</span>
                  </div>

                  {onCancel && (
                    <button
                      onClick={() => handleCancel(transfer.id, transfer.type || 'torrent')}
                      disabled={isCancelling}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20 disabled:opacity-50"
                      title="Cancel & remove download from Seedr"
                    >
                      {isCancelling ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="w-full bg-gray-950/80 rounded-full h-2 overflow-hidden border border-gray-800">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 relative"
                  style={{ width: `${Math.max(progress, 3)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
