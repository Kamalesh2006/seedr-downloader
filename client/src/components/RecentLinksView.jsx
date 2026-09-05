import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Copy, 
  Check, 
  RotateCw, 
  FileText, 
  Film, 
  Music, 
  Archive,
  History,
  Search,
  Calendar,
  Layers,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { extractMagnetName, formatBytes } from '../utils/magnet';

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

export default function RecentLinksView({ 
  magnets = [], 
  onRemove, 
  onClearAll, 
  onRetry,
  onAddMagnet,
  onAddToQueue
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [restoringId, setRestoringId] = useState(null);

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

  const filteredMagnets = useMemo(() => {
    if (!searchFilter.trim()) return magnets;
    const q = searchFilter.toLowerCase().trim();
    return magnets.filter(m => {
      const name = (m.title || m.name || extractMagnetName(m.magnet) || '').toLowerCase();
      const hash = (m.hash || '').toLowerCase();
      const reason = (m.deletedReason || '').toLowerCase();
      return name.includes(q) || hash.includes(q) || reason.includes(q);
    });
  }, [magnets, searchFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[#00DF81]">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Deleted Magnet Links
              <span className="text-xs font-mono font-bold text-[#00DF81] bg-[#00DF81]/10 px-2.5 py-0.5 rounded-full border border-[#00DF81]/20">
                {magnets.length}
              </span>
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Past 30 Days
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Magnet links deleted from Seedr storage in the past 30 days. Easily copy or restore downloads at any time.
          </p>
        </div>

        {/* Clear History Button */}
        {magnets.length > 0 && onClearAll && (
          <div>
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-slate-400 hover:text-red-400 px-3.5 py-2 rounded-xl hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 font-medium flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear 30-Day History
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/80 px-3 py-1.5 rounded-xl text-xs shadow-lg">
                <span className="text-red-200 font-medium">Clear all 30-day deleted links?</span>
                <button
                  onClick={() => {
                    onClearAll();
                    setShowClearConfirm(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg font-bold text-xs transition-colors shadow-sm"
                >
                  Yes, Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="text-slate-400 px-1.5 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter / Search Bar if items exist */}
      {magnets.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search deleted magnet links by title or hash..."
            className="w-full bg-[#111927] border border-[#1E293B] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00DF81] transition-all"
          />
          {searchFilter && (
            <button 
              onClick={() => setSearchFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Deleted Magnets List */}
      {magnets.length === 0 ? (
        <div className="bg-[#111927] rounded-2xl border border-[#1E293B] p-12 text-center text-slate-500 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="p-4 bg-[#141D2E] rounded-2xl w-fit mx-auto mb-4 border border-[#1E293B] shadow-inner">
            <Trash2 className="w-9 h-9 text-[#00DF81] opacity-70" />
          </div>
          <h4 className="text-base sm:text-lg font-bold text-slate-200">No deleted magnet links in the past 30 days</h4>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
            When you delete files or torrents from Seedr to free up account space, their magnet links will be preserved here for 30 days so you can easily restore or copy them.
          </p>
        </div>
      ) : filteredMagnets.length === 0 ? (
        <div className="bg-[#111927] rounded-2xl border border-[#1E293B] p-8 text-center text-slate-400 shadow-lg">
          <p className="text-sm">No deleted magnet links match "{searchFilter}"</p>
          <button 
            onClick={() => setSearchFilter('')}
            className="mt-2 text-xs text-[#00DF81] hover:underline font-medium"
          >
            Reset filter
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredMagnets.map((m) => {
            const displayName = m.title || m.name || extractMagnetName(m.magnet) || 'Deleted Torrent';
            const isCopied = copiedId === m.id;
            const isRestoring = restoringId === m.id;
            const relativeTime = formatRelativeTime(m.deletedAt);
            const fullDate = m.deletedAt ? new Date(m.deletedAt).toLocaleString() : '';

            return (
              <div 
                key={m.id} 
                className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 sm:p-5 space-y-3.5 relative group shadow-lg shadow-black/20 hover:border-slate-700 hover:shadow-black/40 transition-all"
              >
                {/* Top Row: Icon, Title & Delete */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="p-2.5 bg-[#151F32] rounded-xl border border-[#1E293B] shrink-0 mt-0.5">
                      {getFileIcon(displayName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Torrent File Name */}
                      <h4 className="text-sm sm:text-base font-bold text-slate-100 break-words line-clamp-2" title={displayName}>
                        {displayName}
                      </h4>

                      {/* Deletion Time, Reason & Size */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {/* Relative Deletion Badge */}
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"
                          title={`Deleted on: ${fullDate}`}
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          Deleted {relativeTime}
                        </span>

                        {m.size && (
                          <span className="text-[11px] text-slate-300 font-mono bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                            {formatBytes(m.size)}
                          </span>
                        )}

                        {m.deletedReason && (
                          <span className="text-[11px] text-slate-400 bg-[#090F1C] px-2 py-0.5 rounded-md border border-[#1E293B] truncate max-w-xs">
                            {m.deletedReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove permanently from history */}
                  {onRemove && (
                    <button
                      onClick={() => onRemove(m.id)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition-colors shrink-0"
                      title="Permanently remove from 30-day history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Bottom Row: Magnet URI Preview + Quick Actions */}
                <div className="pt-2 border-t border-[#1E293B]/70 flex flex-wrap items-center justify-between gap-3">
                  {/* Copy Magnet Link */}
                  <button
                    onClick={(e) => handleCopyMagnet(e, m.magnet, m.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 hover:text-white bg-[#090F1C] hover:bg-[#151F32] px-3 py-1.5 rounded-xl border border-[#1E293B] transition-colors max-w-md truncate"
                    title="Click to copy full magnet URI"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#00DF81]" />
                        <span className="text-[#00DF81] font-sans font-semibold">Magnet URI Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{m.magnet ? `${m.magnet.substring(0, 38)}...` : (m.hash || 'Copy Magnet')}</span>
                      </>
                    )}
                  </button>

                  {/* Restore Actions */}
                  <div className="flex items-center gap-2">
                    {onAddToQueue && (
                      <button
                        onClick={() => onAddToQueue(m.magnet, displayName, m.size)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
                        title="Schedule in Upcoming Queue"
                      >
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Add to Queue</span>
                      </button>
                    )}

                    {(onAddMagnet || onRetry) && (
                      <button
                        disabled={isRestoring}
                        onClick={() => handleRestore(m.magnet, displayName, m.size, m.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00DF81]/15 text-[#00DF81] hover:bg-[#00DF81]/25 border border-[#00DF81]/30 transition-all active:scale-95 disabled:opacity-50"
                        title="Re-download this torrent in Seedr cloud"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                        <span>{isRestoring ? 'Restoring...' : 'Restore to Seedr'}</span>
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
