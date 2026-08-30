import React, { useState } from 'react';
import { 
  History, 
  Copy, 
  Check, 
  CloudDownload, 
  Trash2, 
  Clock, 
  ExternalLink, 
  FileText, 
  X, 
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { formatRelativeTime } from '../utils/magnet';

export default function RecentMagnetsModal({ 
  isOpen, 
  onClose, 
  recentMagnets = [], 
  onSelectMagnet, 
  onAddMagnet, 
  onRemoveMagnet, 
  onClearMagnets 
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (id, magnet) => {
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAdd = (item) => {
    onAddMagnet(item.magnet, item.name);
  };

  const handleUseInInput = (item) => {
    onSelectMagnet(item.magnet, item.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-gray-900 border border-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between bg-gray-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-100">Recent Magnet Links</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {recentMagnets.length} / 10
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Recently added & pasted torrents with detected file names</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {recentMagnets.length > 0 && !showClearConfirm && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-gray-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Clear all recent links"
              >
                Clear All
              </button>
            )}

            {showClearConfirm && (
              <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-800/60 px-2 py-1 rounded-lg text-xs">
                <span className="text-red-300 font-medium">Clear all?</span>
                <button
                  onClick={() => {
                    onClearMagnets();
                    setShowClearConfirm(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="text-gray-400 hover:text-gray-200 px-1 py-0.5"
                >
                  No
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Items List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {recentMagnets.length === 0 ? (
            <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center">
              <div className="p-4 bg-gray-800/40 rounded-full mb-3 border border-gray-800">
                <History className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="text-base font-semibold text-gray-300">No recent magnet links</h4>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                When you paste magnet links or add torrents from search results, they will automatically be recorded here with their detected file names.
              </p>
            </div>
          ) : (
            recentMagnets.map((item, idx) => (
              <div
                key={item.id || idx}
                className="group bg-gray-800/40 hover:bg-gray-800/70 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all duration-200 relative overflow-hidden"
              >
                {/* Header: File Name & Time */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="p-2 bg-gray-800 rounded-lg text-emerald-400 border border-gray-700/50 shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 
                        className="text-sm font-semibold text-gray-100 truncate group-hover:text-emerald-300 transition-colors"
                        title={item.name}
                      >
                        {item.name || 'Unnamed Torrent'}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(item.addedAt)}
                        </span>
                        {item.size && (
                          <span className="text-gray-400 font-medium">
                            • {item.size}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove single item button */}
                  <button
                    onClick={() => onRemoveMagnet(item.id)}
                    className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Magnet Link Preview with Copy */}
                <div className="bg-gray-950/60 border border-gray-800/80 rounded-lg px-3 py-2 flex items-center justify-between gap-2 mb-3">
                  <span 
                    className="font-mono text-xs text-gray-400 truncate flex-1 select-all"
                    title={item.magnet}
                  >
                    {item.magnet}
                  </span>
                  
                  <button
                    onClick={() => handleCopy(item.id, item.magnet)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors shrink-0"
                    title="Copy magnet link"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-800/40">
                  <button
                    onClick={() => handleUseInInput(item)}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Load in Input
                  </button>

                  <button
                    onClick={() => handleAdd(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 rounded-lg shadow-sm shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    Add to Seedr
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>History saved locally in your browser</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
