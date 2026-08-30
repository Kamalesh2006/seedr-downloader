import React, { useState } from 'react';
import { 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  X, 
  ArrowDownToLine, 
  Trash2, 
  Copy, 
  Check, 
  RotateCw, 
  AlertCircle, 
  FileText, 
  Film, 
  Music, 
  Archive,
  Download,
  Plus
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

export default function RecentMagnetsModal({ 
  isOpen, 
  onClose, 
  magnets = [], 
  onRemove, 
  onClearAll,
  onRetry 
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const handleCopyMagnet = (e, magnet, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#111927]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">Recent Magnet Links</h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                {magnets.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Pasted magnet links and cloud conversion history</p>
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {magnets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#00DF81]" />
              <p className="font-semibold text-slate-300 text-sm">No magnet links in history</p>
              <p className="text-xs mt-1 text-slate-500 max-w-sm mx-auto">
                Pasted magnet links will automatically be saved here with real-time download progress and direct links.
              </p>
            </div>
          ) : (
            magnets.map((m) => {
              const displayName = m.title || m.name || extractMagnetName(m.magnet) || 'Torrent Download';
              const isCopied = copiedId === m.id;
              const isFailed = m.status === 'failed';
              const isFinished = m.status === 'finished';
              const isDownloading = m.status === 'downloading' || m.status === 'queued';

              return (
                <div key={m.id} className="bg-[#090F1C] border border-[#1E293B] rounded-xl p-4 space-y-3 relative group transition-colors hover:border-slate-700">
                  {/* Top Row: Icon, Title & Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {isFinished ? (
                          <div className="p-1.5 bg-[#00DF81]/10 text-[#00DF81] rounded-lg border border-[#00DF81]/20">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        ) : isFailed ? (
                          <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
                            <Clock className="w-4 h-4 animate-pulse" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Displayed Torrent File Name */}
                        <h4 className="text-xs sm:text-sm font-bold text-slate-100 break-words line-clamp-2" title={displayName}>
                          {displayName}
                        </h4>

                        {/* Magnet Link Preview with Copy */}
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={(e) => handleCopyMagnet(e, m.magnet, m.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white bg-[#141D2E] px-2 py-0.5 rounded border border-[#1E293B] transition-colors max-w-full truncate"
                            title="Click to copy full magnet URI"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-[#00DF81]" />
                                <span className="text-[#00DF81]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{m.magnet.substring(0, 42)}...</span>
                              </>
                            )}
                          </button>

                          {m.size && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatBytes(m.size)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete item button */}
                    <button
                      onClick={() => onRemove(m.id)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors shrink-0"
                      title="Remove from history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Progress bar (when active) */}
                  {isDownloading && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{m.status === 'downloading' ? 'Downloading in Seedr...' : 'Queued...'}</span>
                        <span className="font-medium text-[#00DF81]">{m.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-[#111927] rounded-full h-1.5 overflow-hidden border border-[#1E293B]">
                        <div 
                          className="bg-striped-mint h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(m.progress || 0, 3)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Finished Files List & Direct Download Links */}
                  {isFinished && m.files && m.files.length > 0 && (
                    <div className="pt-2 border-t border-[#1E293B]/80 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-400">Downloaded Files:</div>
                      {m.files.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 text-xs bg-[#00DF81]/10 hover:bg-[#00DF81]/20 text-[#00DF81] px-3 py-2 rounded-xl transition-colors border border-[#00DF81]/20 font-medium"
                        >
                          <div className="flex items-center gap-2 truncate flex-1">
                            {getFileIcon(file.name)}
                            <span className="truncate">{file.name}</span>
                          </div>
                          <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Failed status notice with Retry/Re-add button */}
                  {isFailed && (
                    <div className="pt-2 border-t border-[#1E293B]/80 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Failed to download (seeders unavailable or storage occupied)
                      </span>

                      {onRetry && (
                        <button
                          onClick={() => onRetry(m.magnet, displayName)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-[#00DF81]/15 text-[#00DF81] hover:bg-[#00DF81]/25 border border-[#00DF81]/30 transition-all"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Retry in Seedr</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#1E293B] bg-[#111927] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
