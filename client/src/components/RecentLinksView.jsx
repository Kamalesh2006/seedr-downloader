import React, { useState } from 'react';
import { 
  CheckCircle, 
  Clock, 
  Trash2, 
  Copy, 
  Check, 
  RotateCw, 
  AlertCircle, 
  FileText, 
  Film, 
  Music, 
  Archive,
  ArrowDownToLine,
  History,
  Sparkles
} from 'lucide-react';
import { extractMagnetName, formatBytes } from '../utils/magnet';
import SearchBar from './SearchBar';

function getFileIcon(fileName) {
  if (!fileName) return <FileText className="w-5 h-5 text-slate-400" />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov':
    case 'webm':
      return <Film className="w-5 h-5 text-sky-400" />;
    case 'mp3':
    case 'flac':
    case 'wav':
    case 'm4a':
      return <Music className="w-5 h-5 text-pink-400" />;
    case 'zip':
    case 'rar':
    case '7z':
    case 'iso':
      return <Archive className="w-5 h-5 text-amber-400" />;
    default:
      return <FileText className="w-5 h-5 text-[#00DF81]" />;
  }
}

export default function RecentLinksView({ 
  magnets = [], 
  onRemove, 
  onClearAll, 
  onRetry,
  onSearch,
  onAddMagnet,
  onAddToQueue,
  searchLoading
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleCopyMagnet = (e, magnet, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Recent Magnet Links
              <span className="text-xs font-mono font-bold text-[#00DF81] bg-[#00DF81]/10 px-2 py-0.5 rounded-full border border-[#00DF81]/20">
                {magnets.length}
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Pasted magnet links and cloud direct conversion history
          </p>
        </div>

        {/* Clear History Button */}
        {magnets.length > 0 && onClearAll && (
          <div>
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 font-medium"
              >
                Clear History
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-800/60 px-2.5 py-1 rounded-xl text-xs">
                <span className="text-red-300 text-xs">Clear all?</span>
                <button
                  onClick={() => {
                    onClearAll();
                    setShowClearConfirm(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-0.5 rounded-lg font-bold text-xs shadow-sm"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="text-slate-400 px-1.5 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search & Magnet Input Card for quickly pasting new links */}
      <SearchBar 
        onSearch={onSearch}
        onAddMagnet={onAddMagnet}
        onAddToQueue={onAddToQueue}
        loading={searchLoading}
        recentCount={magnets.length}
      />

      {/* Torrents & Files List */}
      {magnets.length === 0 ? (
        <div className="bg-[#111927] rounded-2xl border border-[#1E293B] p-12 text-center text-slate-500 shadow-lg">
          <div className="p-4 bg-[#141D2E] rounded-2xl w-fit mx-auto mb-3 border border-[#1E293B]">
            <Clock className="w-8 h-8 text-[#00DF81] opacity-60" />
          </div>
          <h4 className="text-base font-bold text-slate-200">No magnet links in history</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Pasted magnet links will automatically be saved here with real-time download progress and direct download links.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {magnets.map((m) => {
            const displayName = m.title || m.name || extractMagnetName(m.magnet) || 'Torrent Download';
            const isCopied = copiedId === m.id;
            const isFailed = m.status === 'failed';
            const isFinished = m.status === 'finished';
            const isDownloading = m.status === 'downloading' || m.status === 'queued';

            return (
              <div 
                key={m.id} 
                className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 sm:p-5 space-y-3.5 relative group shadow-lg shadow-black/20 hover:border-slate-700 transition-all"
              >
                {/* Top Row: Icon, Title & Delete */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2.5 bg-[#151F32] rounded-xl border border-[#1E293B] shrink-0 mt-0.5">
                      {isFinished ? (
                        <CheckCircle className="w-5 h-5 text-[#00DF81]" />
                      ) : isFailed ? (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-sky-400 animate-pulse" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Torrent File Name */}
                      <h4 className="text-sm sm:text-base font-bold text-slate-100 break-words line-clamp-2" title={displayName}>
                        {displayName}
                      </h4>

                      {/* Magnet Link Preview & File Size */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <button
                          onClick={(e) => handleCopyMagnet(e, m.magnet, m.id)}
                          className="inline-flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-white bg-[#090F1C] px-2.5 py-1 rounded-lg border border-[#1E293B] transition-colors max-w-full truncate"
                          title="Click to copy full magnet URI"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#00DF81]" />
                              <span className="text-[#00DF81]">Copied URI</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate">{m.magnet.substring(0, 36)}...</span>
                            </>
                          )}
                        </button>

                        {m.size && (
                          <span className="text-xs text-slate-400 font-mono">
                            {formatBytes(m.size)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  {onRemove && (
                    <button
                      onClick={() => onRemove(m.id)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition-colors shrink-0"
                      title="Remove from history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Real-time Progress Bar */}
                {isDownloading && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{m.status === 'downloading' ? 'Downloading in Seedr cloud...' : 'Queued...'}</span>
                      <span className="font-bold text-[#00DF81] font-mono">{m.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-[#090F1C] rounded-full h-2 overflow-hidden border border-[#1E293B]">
                      <div 
                        className="bg-striped-mint h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(m.progress || 0, 3)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Downloaded Files & Direct Download Links */}
                {isFinished && m.files && m.files.length > 0 && (
                  <div className="pt-2.5 border-t border-[#1E293B] space-y-2">
                    <div className="text-xs font-bold text-slate-300">Direct Download Files:</div>
                    <div className="space-y-1.5">
                      {m.files.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 text-xs bg-[#00DF81]/10 hover:bg-[#00DF81]/20 text-[#00DF81] px-3.5 py-2.5 rounded-xl transition-colors border border-[#00DF81]/20 font-semibold"
                        >
                          <div className="flex items-center gap-2.5 truncate flex-1">
                            {getFileIcon(file.name)}
                            <span className="truncate">{file.name}</span>
                          </div>
                          <ArrowDownToLine className="w-4 h-4 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed notice & Retry option */}
                {isFailed && (
                  <div className="pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2.5">
                    <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Failed to download (seeders unavailable or space occupied)
                    </span>

                    {onRetry && (
                      <button
                        onClick={() => onRetry(m.magnet, displayName)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00DF81]/15 text-[#00DF81] hover:bg-[#00DF81]/25 border border-[#00DF81]/30 transition-all active:scale-95"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Retry in Seedr</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
