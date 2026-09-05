import React, { useState } from 'react';
import { 
  ListOrdered, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Play, 
  Clock, 
  ToggleLeft, 
  ToggleRight, 
  AlertCircle, 
  Check, 
  Copy,
  CloudDownload,
  Loader2,
  Link as LinkIcon,
  Sparkles
} from 'lucide-react';
import { formatBytes, formatRelativeTime } from '../utils/magnet';

export default function QueueManager({ 
  queue = [], 
  isAutoEnabled = true, 
  onMoveItem, 
  onRemoveItem, 
  onClearQueue, 
  onToggleAuto, 
  onSendNow,
  onShowToast
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

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

  const handleCopy = (magnet, id) => {
    if (!magnet) return;
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    onShowToast?.('Magnet link copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

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
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${
                queue.length > 0 
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {queue.length} Queued
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">Downloads start automatically when space is available.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Auto-Schedule Switch */}
          <button
            onClick={() => onToggleAuto?.(!isAutoEnabled)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isAutoEnabled 
                ? 'bg-[#00DF81]/10 border-[#00DF81]/30 text-[#00DF81]' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={isAutoEnabled ? 'Auto-dispatcher is active' : 'Auto-dispatcher is paused'}
          >
            {isAutoEnabled ? <ToggleRight className="w-4 h-4 text-[#00DF81]" /> : <ToggleLeft className="w-4 h-4" />}
            <span className="hidden sm:inline">{isAutoEnabled ? 'Auto-Schedule ON' : 'Paused'}</span>
          </button>

          {/* Clear Queue Button (if queue > 0) */}
          {queue.length > 0 && (
            !showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-slate-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
              >
                Clear All
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 px-2 py-1 rounded-lg text-xs">
                <span className="text-red-300 text-[11px]">Clear?</span>
                <button
                  onClick={() => {
                    onClearQueue?.();
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
            )
          )}
        </div>
      </div>

      {/* Queue Items List OR Empty State */}
      {queue.length === 0 ? (
        <div className="p-8 text-center space-y-3 bg-[#090F1C]/40">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <ListOrdered className="w-5 h-5 opacity-80" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-200">
              Your queue is empty
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Paste a magnet link above or queue a release while browsing movies.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#1E293B]/60">
          {queue.map((item, index) => {
            const isSending = sendingId === item.id;
            const isFirst = index === 0;
            const isCopied = copiedId === item.id;
            const magnetPreview = item.magnet ? item.magnet.slice(0, 60) + '...' : '';

            return (
              <div 
                key={item.id} 
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#152033] transition-colors"
              >
                {/* Left: Queue index & metadata */}
                <div className="flex items-start sm:items-center gap-3 overflow-hidden flex-1 min-w-0">
                  {/* Index badge */}
                  <div className={`w-7 h-7 rounded-xl text-xs font-black flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                    isFirst 
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40 ring-2 ring-indigo-400/30' 
                      : 'bg-[#090F1C] text-slate-400 border border-[#1E293B]'
                  }`}>
                    #{index + 1}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-100 font-bold text-xs sm:text-sm truncate" title={item.name}>
                        {item.name}
                      </span>
                      {isFirst && isAutoEnabled && (
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#00DF81]/15 text-[#00DF81] border border-[#00DF81]/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81] animate-pulse" />
                          Next in line
                        </span>
                      )}
                    </div>

                    {/* Magnet link preview & meta */}
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                      {item.size && (
                        <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {item.size}
                        </span>
                      )}
                      {item.magnet && (
                        <span className="font-mono text-slate-500 text-[10px] truncate max-w-[200px] sm:max-w-[280px]" title={item.magnet}>
                          {magnetPreview}
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatRelativeTime(item.addedAt || item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-end sm:self-auto pt-1 sm:pt-0">
                  {/* Send Now Button */}
                  <button
                    onClick={() => handleSendNow(item)}
                    disabled={isSending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#00DF81]/15 hover:bg-[#00DF81]/25 text-[#00DF81] rounded-xl border border-[#00DF81]/30 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                    title="Start download in Seedr immediately"
                  >
                    {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>Send Now</span>
                  </button>

                  {/* Copy Magnet Link */}
                  {item.magnet && (
                    <button
                      onClick={() => handleCopy(item.magnet, item.id)}
                      className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                      title="Copy full magnet link"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Move Up */}
                  {index > 0 && onMoveItem && (
                    <button
                      onClick={() => onMoveItem(index, index - 1)}
                      className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                      title="Move up in queue order"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Move Down */}
                  {index < queue.length - 1 && onMoveItem && (
                    <button
                      onClick={() => onMoveItem(index, index + 1)}
                      className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                      title="Move down in queue order"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Remove */}
                  {onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-slate-700 hover:border-red-500/30"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
