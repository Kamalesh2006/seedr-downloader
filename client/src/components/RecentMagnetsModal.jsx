import React from 'react';
import { ExternalLink, CheckCircle, Clock, X, ArrowDownToLine, Trash2 } from 'lucide-react';

export default function RecentMagnetsModal({ isOpen, onClose, magnets, onRemove }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Manual Magnet Converter</h3>
            <p className="text-xs text-gray-500 mt-0.5">Pasted magnet links converted to direct downloads</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {magnets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-500" />
              <p className="font-medium text-gray-400">No pasted magnet links yet</p>
              <p className="text-xs mt-1">Pasted magnets will automatically poll and generate direct download buttons here.</p>
            </div>
          ) : (
            magnets.map((m) => (
              <div key={m.id} className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 space-y-3 relative group">
                {/* Delete button */}
                <button
                  onClick={() => onRemove(m.id)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors md:opacity-0 group-hover:opacity-100"
                  title="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3 pr-8">
                  <div className="mt-1">
                    {m.status === 'finished' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-blue-400 animate-pulse shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-200 truncate" title={m.title}>
                      {m.title}
                    </h4>
                    <span className="inline-flex text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-full">
                      {m.magnet.substring(0, 60)}...
                    </span>
                  </div>
                </div>

                {/* Progress bar (if not completed) */}
                {m.status !== 'finished' && m.status !== 'failed' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{m.status === 'downloading' ? 'Downloading...' : 'Queued...'}</span>
                      <span className="font-medium text-emerald-400">{m.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${m.progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Download links */}
                {m.status === 'finished' && (
                  <div className="pt-2 border-t border-gray-800/60">
                    <div className="text-xs text-gray-400 font-medium mb-2">Direct Download Links:</div>
                    {m.files && m.files.length > 0 ? (
                      <div className="space-y-1.5">
                        {m.files.map((file, idx) => (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-2 rounded-lg transition-colors border border-emerald-500/20"
                          >
                            <span className="truncate font-medium flex-1">{file.name}</span>
                            <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic flex items-center justify-between">
                        <span>Ready in Seedr list, fetching links...</span>
                        <button 
                          onClick={() => window.location.reload()} 
                          className="text-emerald-400 hover:underline"
                        >
                          Refresh list
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {m.status === 'failed' && (
                  <p className="text-xs text-red-400 font-medium">Failed to process magnet link.</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
