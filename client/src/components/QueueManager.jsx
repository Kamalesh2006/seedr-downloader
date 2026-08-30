import React, { useState } from 'react';
import { 
  ListOrdered, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Play, 
  Sparkles, 
  Clock, 
  ToggleLeft, 
  ToggleRight, 
  AlertCircle, 
  Check, 
  CloudDownload,
  Info,
  Loader2
} from 'lucide-react';
import { formatBytes, formatRelativeTime } from '../utils/magnet';

export default function QueueManager({ 
  queue = [], 
  isAutoEnabled = true, 
  onMoveItem, 
  onRemoveItem, 
  onClearQueue, 
  onToggleAuto, 
  onSendNow 
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const handleSendNow = async (item) => {
    setSendingId(item.id);
    try {
      await onSendNow(item.magnet, item.name, item.id, item.size);
    } catch (e) {
      console.error('Failed to send item immediately', e);
    } finally {
      setSendingId(null);
    }
  };

  if (!queue || queue.length === 0) return null;

  return (
    <div className="bg-[#111927] rounded-2xl shadow-lg shadow-black/20 border border-[#1E293B] overflow-hidden mb-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1E293B] bg-[#111927] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">Upcoming Queue</h3>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {queue.length} Queued
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Auto-dispatches in order as storage is freed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Auto-Schedule Switch */}
          <button
            onClick={() => onToggleAuto(!isAutoEnabled)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isAutoEnabled 
                ? 'bg-[#00DF81]/10 border-[#00DF81]/30 text-[#00DF81]' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAutoEnabled ? <ToggleRight className="w-4 h-4 text-[#00DF81]" /> : <ToggleLeft className="w-4 h-4" />}
            <span className="hidden sm:inline">{isAutoEnabled ? 'Auto-Schedule ON' : 'Paused'}</span>
          </button>

          {/* Clear Queue Button */}
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-slate-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Clear
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 px-2 py-1 rounded-lg text-xs">
              <span className="text-red-300 text-[11px]">Clear?</span>
              <button
                onClick={() => {
                  onClearQueue();
                  setShowClearConfirm(false);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium text-[11px]"
              >
                Yes
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="text-slate-400 px-1 hover:text-white text-[11px]"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Queue Items List */}
      <div className="divide-y divide-[#1E293B]/60">
        {queue.map((item, index) => {
          const isSending = sendingId === item.id;
          const isFirst = index === 0;

          return (
            <div 
              key={item.id} 
              className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#152033] transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                {/* Index badge */}
                <div className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                  isFirst 
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' 
                    : 'bg-[#090F1C] text-slate-400 border border-[#1E293B]'
                }`}>
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-slate-100 font-semibold text-xs sm:text-sm truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    {item.size && <span className="font-mono">{item.size}</span>}
                    {item.size && <span>•</span>}
                    <span>{formatRelativeTime(item.addedAt || item.createdAt)}</span>
                    {isFirst && isAutoEnabled && (
                      <span className="text-indigo-300 font-semibold flex items-center gap-1">
                        • Next in line
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Send Now Button */}
                <button
                  onClick={() => handleSendNow(item)}
                  disabled={isSending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#00DF81]/15 hover:bg-[#00DF81]/25 text-[#00DF81] rounded-xl border border-[#00DF81]/30 transition-all disabled:opacity-50"
                  title="Send to Seedr immediately"
                >
                  {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span className="hidden sm:inline">Send Now</span>
                </button>

                {/* Move Up */}
                {index > 0 && onMoveItem && (
                  <button
                    onClick={() => onMoveItem(index, index - 1)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                )}

                {/* Move Down */}
                {index < queue.length - 1 && onMoveItem && (
                  <button
                    onClick={() => onMoveItem(index, index + 1)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                )}

                {/* Remove */}
                {onRemoveItem && (
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
