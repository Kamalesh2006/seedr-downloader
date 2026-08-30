import React from 'react';
import { 
  X, 
  Play, 
  Download, 
  Copy, 
  Check, 
  Trash2, 
  Film, 
  Folder, 
  FileText, 
  ExternalLink 
} from 'lucide-react';
import { formatBytes, formatRelativeTime } from '../utils/magnet';

export default function FileActionSheet({ 
  isOpen, 
  file, 
  onClose, 
  onStream, 
  onDownload, 
  onCopyLink, 
  isCopied, 
  onDelete 
}) {
  if (!isOpen || !file) return null;

  const isFolder = file.type === 'folder';
  const ext = file.name?.split('.').pop()?.toLowerCase();
  const isMedia = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'mp3', 'wav', 'flac', 'm4a'].includes(ext);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center md:hidden animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full bg-[#111927] border-t border-[#1E293B] rounded-t-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-250 safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab bar */}
        <div className="w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto mb-4" />

        {/* File Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 bg-[#162032] rounded-2xl border border-[#1E293B] shrink-0">
              {isFolder ? (
                <Folder className="w-6 h-6 text-[#00DF81]" />
              ) : isMedia ? (
                <Film className="w-6 h-6 text-sky-400" />
              ) : (
                <FileText className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white truncate" title={file.name}>
                {file.name}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatBytes(file.size)} • {formatRelativeTime(file.created || file.last_update)}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-2.5 mt-4">
          {!isFolder && (
            <>
              {isMedia && (
                <button
                  onClick={() => {
                    onClose();
                    onStream(file);
                  }}
                  className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#00DF81]/10 border border-[#00DF81]/25 text-[#00DF81] font-semibold text-sm hover:bg-[#00DF81]/20 transition-all active:scale-[0.99]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Stream / Play Video</span>
                </button>
              )}

              <button
                onClick={() => {
                  onClose();
                  onDownload(file.id);
                }}
                className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#00DF81] text-[#071911] font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
              >
                <Download className="w-5 h-5" />
                <span>Direct Download</span>
              </button>

              <button
                onClick={(e) => onCopyLink(e, file.id)}
                className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-[#182438] border border-[#1E293B] text-slate-200 font-semibold text-sm hover:bg-[#1E2E46] transition-all active:scale-[0.99]"
              >
                {isCopied ? (
                  <>
                    <Check className="w-5 h-5 text-[#00DF81]" />
                    <span className="text-[#00DF81]">Direct Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 text-slate-400" />
                    <span>Copy Direct Download Link</span>
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={() => {
              onClose();
              onDelete(file);
            }}
            className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-red-950/20 border border-red-800/40 text-red-400 font-semibold text-sm hover:bg-red-950/30 transition-all active:scale-[0.99]"
          >
            <Trash2 className="w-5 h-5" />
            <span>Delete from Seedr Storage</span>
          </button>
        </div>
      </div>
    </div>
  );
}
