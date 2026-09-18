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
  Sparkles,
  Magnet
} from 'lucide-react';
import { formatBytes, formatRelativeTime, ensureMagnetUri } from '../utils/magnet';

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
    <div className="bg-white dark:bg-[#111927] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1E293B] overflow-hidden mb-6 transition-colors duration-200 animate-in fade-in">
      {/* Header */}
      <div className="p-4 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#111927]">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-500/20 shrink-0">
              <ListOrdered className="w-4 h-4 sm:w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">Upcoming Queue</h3>
              <span className={`px-2 py-0.5 text-[11px] sm:text-xs font-bold rounded-full border shrink-0 ${
                queue.length > 0 
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}>
                {queue.length} Queued
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Auto-Schedule Switch */}
            <button
              onClick={() => onToggleAuto?.(!isAutoEnabled)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                isAutoEnabled 
                  ? 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-[#00DF81]/10 dark:hover:bg-[#00DF81]/20 dark:text-[#00DF81] dark:border-[#00DF81]/30' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700'
              }`}
              title={isAutoEnabled ? 'Auto-dispatcher is active' : 'Auto-dispatcher is paused'}
            >
              {isAutoEnabled ? <ToggleRight className="w-4 h-4 text-emerald-600 dark:text-[#00DF81]" /> : <ToggleLeft className="w-4 h-4" />}
              <span className="text-xs">{isAutoEnabled ? 'Auto: ON' : 'Paused'}</span>
            </button>

            {/* Clear Queue Button (if queue > 0) */}
            {queue.length > 0 && (
              !showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/20"
                >
                  Clear All
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 px-2 py-1 rounded-lg text-xs">
                  <span className="text-red-600 dark:text-red-300 text-[11px] font-semibold">Clear?</span>
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
                    className="text-slate-500 dark:text-slate-400 px-1 hover:text-slate-800 dark:hover:text-white text-[11px]"
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Subtitle description */}
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 pl-8 sm:pl-10">
          Downloads start automatically when space is available.
        </p>
      </div>

      {/* Queue Items List OR Empty State */}
      {queue.length === 0 ? (
        <div className="p-6 sm:p-8 text-center space-y-3 bg-slate-50/60 dark:bg-[#090F1C]/30">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Upcoming Queue is Empty
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Torrents download immediately in Seedr Cloud. If storage is occupied, new downloads are automatically queued here and start as soon as space is freed.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-[#1E293B]/60">
          {queue.map((item, index) => {
            const isSending = sendingId === item.id;
            const isFirst = index === 0;
            const isCopied = copiedId === item.id;
            const magnetPreview = item.magnet ? item.magnet.slice(0, 60) + '...' : '';

            return (
              <div 
                key={item.id} 
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-[#152033] transition-colors"
              >
                {/* Left: Queue index & metadata */}
                <div className="flex items-start sm:items-center gap-3 overflow-hidden flex-1 min-w-0">
                  {/* Index badge */}
                  <div className={`w-7 h-7 rounded-xl text-xs font-black flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                    isFirst 
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' 
                      : 'bg-slate-100 dark:bg-[#090F1C] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E293B]'
                  }`}>
                    #{index + 1}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm truncate" title={item.name}>
                        {item.name}
                      </span>
                      {isFirst && isAutoEnabled && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-[#00DF81]/15 text-emerald-700 dark:text-[#00DF81] border border-emerald-200 dark:border-[#00DF81]/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-[#00DF81] animate-pulse" />
                          Next in line
                        </span>
                      )}
                    </div>

                    {/* Magnet link preview & meta */}
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                      {item.size && (
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20">
                          {item.size}
                        </span>
                      )}
                      {item.magnet && (
                        <span className="font-mono text-slate-400 dark:text-slate-500 text-[10px] truncate max-w-[200px] sm:max-w-[280px]" title={item.magnet}>
                          {magnetPreview}
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatRelativeTime(item.addedAt || item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#1E293B]/50">
                  {/* Send Now Button */}
                  <button
                    onClick={() => handleSendNow(item)}
                    disabled={isSending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-[#00DF81]/15 dark:hover:bg-[#00DF81]/25 dark:text-[#00DF81] dark:border-[#00DF81]/30 rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                    title="Start download in Seedr immediately"
                  >
                    {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>Send Now</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Open in Torrent App */}
                    {item.magnet && (
                      <a
                        href={ensureMagnetUri(item.magnet, item.name || item.title)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowToast?.('Opening torrent app...', 'info');
                        }}
                        className="p-2 text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:hover:text-rose-300 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded-xl transition-all border border-rose-200 dark:border-rose-500/30 active:scale-95"
                        title="Open in Torrent App (Soft link)"
                      >
                        <Magnet className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Copy Magnet Link */}
                    {item.magnet && (
                      <button
                        onClick={() => handleCopy(item.magnet, item.id)}
                        className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 active:scale-95"
                        title="Copy full magnet link"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Move Up */}
                    {index > 0 && onMoveItem && (
                      <button
                        onClick={() => onMoveItem(index, index - 1)}
                        className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 active:scale-95"
                        title="Move up in queue order"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Move Down */}
                    {index < queue.length - 1 && onMoveItem && (
                      <button
                        onClick={() => onMoveItem(index, index + 1)}
                        className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 active:scale-95"
                        title="Move down in queue order"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Remove */}
                    {onRemoveItem && (
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 dark:text-slate-400 dark:hover:text-red-400 dark:bg-slate-800 dark:hover:bg-red-500/10 dark:border-slate-700 dark:hover:border-red-500/30 rounded-xl transition-colors active:scale-95"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
