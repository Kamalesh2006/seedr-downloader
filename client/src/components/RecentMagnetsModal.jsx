import React from 'react';
import { ExternalLink, CheckCircle, Clock, X, ArrowDownToLine, Trash2 } from 'lucide-react';

export default function RecentMagnetsModal({ isOpen, onClose, magnets, onRemove }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#111927]">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Recent Magnet Links</h3>
            <p className="text-xs text-slate-400 mt-0.5">Pasted magnet links history and direct downloads</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {magnets.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#00DF81]" />
              <p className="font-semibold text-slate-300 text-sm">No pasted magnet links yet</p>
              <p className="text-xs mt-1 text-slate-500">Pasted magnets will appear here with instant download links.</p>
            </div>
          ) : (
            magnets.map((m) => (
              <div key={m.id} className="bg-[#090F1C] border border-[#1E293B] rounded-xl p-3.5 space-y-3 relative group">
                {/* Delete button */}
                <button
                  onClick={() => onRemove(m.id)}
                  className="absolute top-3.5 right-3.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                  title="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3 pr-8">
                  <div className="mt-0.5">
                    {m.status === 'finished' ? (
                      <CheckCircle className="w-5 h-5 text-[#00DF81] shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-sky-400 animate-pulse shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200 truncate" title={m.title}>
                      {m.title}
                    </h4>
                    <span className="inline-flex text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-full">
                      {m.magnet.substring(0, 50)}...
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                {m.status !== 'finished' && m.status !== 'failed' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{m.status === 'downloading' ? 'Downloading...' : 'Queued...'}</span>
                      <span className="font-medium text-[#00DF81]">{m.progress}%</span>
                    </div>
                    <div className="w-full bg-[#111927] rounded-full h-1.5 overflow-hidden border border-[#1E293B]">
                      <div 
                        className="bg-striped-mint h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${m.progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Download links */}
                {m.status === 'finished' && (
                  <div className="pt-2 border-t border-[#1E293B]">
                    <div className="text-xs text-slate-400 font-medium mb-1.5">Direct Download Links:</div>
                    {m.files && m.files.length > 0 ? (
                      <div className="space-y-1.5">
                        {m.files.map((file, idx) => (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 text-xs bg-[#00DF81]/10 hover:bg-[#00DF81]/20 text-[#00DF81] px-3 py-2 rounded-xl transition-colors border border-[#00DF81]/20 font-medium"
                          >
                            <span className="truncate flex-1">{file.name}</span>
                            <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">
                        Ready in Seedr list.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
