import React, { useState } from 'react';
import { Activity, Loader2, Trash2, Shield, Clock } from 'lucide-react';
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
    <div className="bg-[#111927] rounded-2xl shadow-lg shadow-black/20 p-4 sm:p-5 mb-6 border border-[#1E293B] animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#00DF81]/10 text-[#00DF81] rounded-xl border border-[#00DF81]/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Active Cloud Downloads
              <span className="text-xs font-normal text-slate-400">
                ({transfers.length})
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400">Torrents currently downloading in your Seedr cloud</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#090F1C] border border-[#1E293B] text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-[#00DF81]" />
          <span>Auto-cleans stalled</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {transfers.map(transfer => {
          const isCancelling = cancellingId === transfer.id;
          const progress = transfer.progress || 0;
          const isStalledOrQueued = progress === 0;

          return (
            <div key={transfer.id} className="bg-[#090F1C] rounded-xl p-3.5 border border-[#1E293B] transition-all hover:bg-[#0D1424]">
              <div className="flex justify-between items-start gap-3 mb-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-slate-100 font-semibold text-xs sm:text-sm truncate" title={transfer.name}>
                    {transfer.name}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    {transfer.size > 0 && (
                      <span className="font-mono">{formatBytes(transfer.size)}</span>
                    )}
                    <span>•</span>
                    <span className={`font-medium ${isStalledOrQueued ? 'text-amber-400' : 'text-[#00DF81]'}`}>
                      {transfer.status === 'downloading' 
                        ? (isStalledOrQueued ? 'Collecting Seeds...' : `Downloading ${progress}%`) 
                        : transfer.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-xs font-semibold font-mono text-[#00DF81] bg-[#00DF81]/10 px-2 py-0.5 rounded-lg border border-[#00DF81]/20 whitespace-nowrap flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{progress}%</span>
                  </div>

                  {onCancel && (
                    <button
                      onClick={() => handleCancel(transfer.id, transfer.type || 'torrent')}
                      disabled={isCancelling}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20 disabled:opacity-50"
                      title="Cancel download"
                    >
                      {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="w-full bg-[#111927] rounded-full h-2 overflow-hidden border border-[#1E293B]">
                <div 
                  className="bg-striped-mint h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(progress, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
