import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Copy, 
  Check, 
  RotateCw, 
  FileText, 
  Film, 
  Music, 
  Archive,
  History,
  Calendar,
  Clock,
  Layers
} from 'lucide-react';
import { extractMagnetName, formatBytes } from '../utils/magnet';

function getFileIcon(fileName) {
  if (!fileName) return <FileText className="w-4 h-4 text-slate-400" />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov':
    case 'webm':
      return <Film className="w-4 h-4 text-sky-400" />;
    case 'mp3':
    case 'flac':
    case 'wav':
    case 'm4a':
      return <Music className="w-4 h-4 text-pink-400" />;
    case 'zip':
    case 'rar':
    case '7z':
    case 'iso':
      return <Archive className="w-4 h-4 text-amber-400" />;
    default:
      return <FileText className="w-4 h-4 text-emerald-400" />;
  }
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function RecentMagnetsModal({ 
  isOpen, 
  onClose, 
  magnets = [], 
  onRemove, 
  onClearAll,
  onRetry,
  onAddMagnet,
  onAddToQueue
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  if (!isOpen) return null;

  const handleCopyMagnet = (e, magnet, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRestore = async (magnet, name, size, id) => {
    setRestoringId(id);
    try {
      if (onAddMagnet) {
        await onAddMagnet(magnet, name, size);
      } else if (onRetry) {
        await onRetry(magnet, name, size);
      }
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#111927]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Deleted Magnet Links
                <span className="text-xs font-mono font-bold text-[#00DF81] bg-[#00DF81]/10 px-2 py-0.5 rounded-full border border-[#00DF81]/20">
                  {magnets.length}
                </span>
              </h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-400" />
                Past 30 Days
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Deleted links preserved for 30 days to copy or restore</p>
          </div>

          <div className="flex items-center gap-2">
            {magnets.length > 0 && onClearAll && (
              !showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-slate-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Clear History
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 px-2 py-1 rounded-lg text-xs">
                  <span className="text-red-300 text-[11px]">Clear all?</span>
                  <button
                    onClick={() => {
                      onClearAll();
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

            <button 
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {magnets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#00DF81]" />
              <p className="font-semibold text-slate-300 text-sm">No deleted magnet links in the past 30 days</p>
              <p className="text-xs mt-1 text-slate-500 max-w-sm mx-auto">
                When you delete torrents or files from Seedr, their magnet links will be preserved here for 30 days.
              </p>
            </div>
          ) : (
            magnets.map((m) => {
              const displayName = m.title || m.name || extractMagnetName(m.magnet) || 'Deleted Torrent';
              const isCopied = copiedId === m.id;
              const isRestoring = restoringId === m.id;
              const relativeTime = formatRelativeTime(m.deletedAt);

              return (
                <div key={m.id} className="bg-[#090F1C] border border-[#1E293B] rounded-xl p-3.5 space-y-3 relative group transition-colors hover:border-slate-700">
                  {/* Top Row: Icon, Title & Delete */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="p-2 bg-[#151F32] rounded-lg border border-[#1E293B] shrink-0 mt-0.5">
                        {getFileIcon(displayName)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-100 break-words line-clamp-2" title={displayName}>
                          {displayName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                            Deleted {relativeTime}
                          </span>

                          {m.size && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatBytes(m.size)}
                            </span>
                          )}

                          {m.deletedReason && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                              • {m.deletedReason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {onRemove && (
                      <button
                        onClick={() => onRemove(m.id)}
                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors shrink-0"
                        title="Remove from history"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-[#1E293B]/60 flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={(e) => handleCopyMagnet(e, m.magnet, m.id)}
                      className="inline-flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-white bg-[#111927] px-2.5 py-1 rounded-lg border border-[#1E293B] transition-colors max-w-[200px] truncate"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-[#00DF81]" />
                          <span className="text-[#00DF81]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{m.magnet ? `${m.magnet.substring(0, 24)}...` : 'Copy Magnet'}</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      {onAddToQueue && (
                        <button
                          onClick={() => onAddToQueue(m.magnet, displayName, m.size)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1"
                        >
                          <Layers className="w-3 h-3 text-indigo-400" />
                          Queue
                        </button>
                      )}

                      {(onAddMagnet || onRetry) && (
                        <button
                          disabled={isRestoring}
                          onClick={() => handleRestore(m.magnet, displayName, m.size, m.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#00DF81]/15 text-[#00DF81] hover:bg-[#00DF81]/25 border border-[#00DF81]/30 flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCw className={`w-3 h-3 ${isRestoring ? 'animate-spin' : ''}`} />
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
