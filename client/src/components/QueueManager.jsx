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
      await onSendNow(item.magnet, item.name, item.id);
    } catch (e) {
      console.error('Failed to send item immediately', e);
    } finally {
      setSendingId(null);
    }
  };

  if (!queue || queue.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden mb-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-100">Upcoming Download Schedule</h3>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {queue.length} Queued
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Automatically dispatched in order as soon as storage is freed or current downloads finish
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-Schedule Switch */}
          <button
            onClick={() => onToggleAuto(!isAutoEnabled)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isAutoEnabled 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
            title={isAutoEnabled ? 'Auto-processing is ACTIVE' : 'Auto-processing is PAUSED'}
          >
            {isAutoEnabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{isAutoEnabled ? 'Auto-Scheduler ON' : 'Paused'}</span>
          </button>

          {/* Clear Queue Button */}
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-gray-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Clear
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 px-2 py-1 rounded-lg text-xs">
              <span className="text-red-300">Clear all?</span>
              <button
                onClick={() => {
                  onClearQueue();
                  setShowClearConfirm(false);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium"
              >
                Yes
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="text-gray-400 hover:text-gray-200 px-1"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Queue Items List */}
      <div className="divide-y divide-gray-800/60">
        {queue.map((item, index) => {
          const isNext = index === 0;
          const isSending = sendingId === item.id;

          return (
            <div 
              key={item.id}
              className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                isNext ? 'bg-indigo-500/5 hover:bg-indigo-500/10 border-l-4 border-indigo-500' : 'hover:bg-gray-800/30'
              }`}
            >
              {/* Order Rank & Info */}
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 ${
                  isNext 
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-950/50' 
                    : 'bg-gray-800 text-gray-300 border border-gray-700'
                }`}>
                  {isNext ? '#1 NEXT' : `#${index + 1}`}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-gray-100 font-semibold text-sm truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-3">
                    {item.size && (
                      <span className="font-medium text-gray-300">{item.size}</span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      Queued {formatRelativeTime(item.addedAt)}
                    </span>
                    {isNext && isAutoEnabled && (
                      <span className="text-indigo-300 font-medium animate-pulse flex items-center gap-1">
                        • Ready for dispatch when space frees
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {/* Move Up / Down */}
                <div className="flex items-center bg-gray-800 rounded-xl p-0.5 border border-gray-700 mr-1">
                  <button
                    onClick={() => onMoveItem(item.id, 'up')}
                    disabled={index === 0}
                    className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 rounded-lg hover:bg-gray-700 transition-colors"
                    title="Move up in schedule"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMoveItem(item.id, 'down')}
                    disabled={index === queue.length - 1}
                    className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 rounded-lg hover:bg-gray-700 transition-colors"
                    title="Move down in schedule"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Send Now Button */}
                <button
                  onClick={() => handleSendNow(item)}
                  disabled={isSending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all disabled:opacity-50"
                  title="Send to Seedr immediately (skip queue waiting)"
                >
                  {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Download Now</span>
                </button>

                {/* Remove Button */}
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                  title="Remove from schedule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info Tip */}
      <div className="px-6 py-2.5 bg-gray-950/60 border-t border-gray-800 text-[11px] text-gray-500 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span>
          As soon as a file is deleted from Seedr or current downloads finish, the <strong>#1 NEXT</strong> link is automatically sent to Seedr.
        </span>
      </div>
    </div>
  );
}
