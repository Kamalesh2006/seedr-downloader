import React, { useState } from 'react';
import { 
  Folder, 
  File, 
  Download, 
  Trash2, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown, 
  HardDrive, 
  Film, 
  Music, 
  Archive, 
  FileText, 
  Image as ImageIcon,
  FileCode,
  Loader2,
  AlertTriangle,
  X,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { formatBytes } from '../utils/magnet';

function getFileIcon(fileName) {
  if (!fileName) return <File className="w-5 h-5 text-gray-400" />;
  const ext = fileName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'flv':
      return <Film className="w-5 h-5 text-indigo-400" />;
    case 'mp3':
    case 'flac':
    case 'wav':
    case 'm4a':
    case 'aac':
    case 'ogg':
      return <Music className="w-5 h-5 text-pink-400" />;
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
    case 'iso':
      return <Archive className="w-5 h-5 text-amber-400" />;
    case 'srt':
    case 'vtt':
    case 'sub':
    case 'ass':
      return <FileText className="w-5 h-5 text-emerald-400" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'gif':
      return <ImageIcon className="w-5 h-5 text-purple-400" />;
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'txt':
    case 'nfo':
      return <FileText className="w-5 h-5 text-blue-400" />;
    default:
      return <File className="w-5 h-5 text-gray-400" />;
  }
}

export default function CompletedFiles({ 
  files = [], 
  storage = { spaceUsed: 0, spaceMax: 0 },
  folderContents = {},
  loading = false,
  onRefresh,
  onFetchFolder,
  onDownload, 
  onDelete 
}) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name, type, parentFolderId }
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const isExpanded = !prev[folderId];
      if (isExpanded && (!folderContents[folderId] || !folderContents[folderId].loaded)) {
        onFetchFolder(folderId);
      }
      return { ...prev, [folderId]: isExpanded };
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTarget.id, deleteTarget.type, deleteTarget.parentFolderId);
      setDeleteTarget(null);
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate storage usage percentage
  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024); // 4.5GB quota
  const usedPercentage = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

  const getStorageColor = (pct) => {
    if (pct >= 90) return 'from-red-500 to-rose-600';
    if (pct >= 75) return 'from-amber-500 to-orange-600';
    return 'from-emerald-500 to-teal-500';
  };

  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden mb-8">
      {/* Header & Storage Capacity Bar */}
      <div className="px-6 py-5 border-b border-gray-800 bg-gray-900/70">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                Files in Seedr Cloud
                <span className="text-xs font-normal text-gray-400">
                  ({files.length} items)
                </span>
              </h3>
              <p className="text-xs text-gray-400">Manage, inspect, download, or delete stored files</p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-all disabled:opacity-50"
            title="Refresh Seedr storage"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{loading ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Storage Usage Metric */}
        <div className="bg-gray-950/60 rounded-xl p-3.5 border border-gray-800/80">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-gray-400 font-medium">Seedr Storage Used</span>
            <span className="text-gray-200 font-semibold font-mono">
              {formatBytes(used)} / {formatBytes(max)} ({usedPercentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-800/80 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${getStorageColor(usedPercentage)} transition-all duration-500`}
              style={{ width: `${Math.max(usedPercentage, 2)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Files and Folders List */}
      {files.length === 0 ? (
        <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
          <div className="p-4 bg-gray-800/40 rounded-full mb-3 border border-gray-800">
            <Folder className="w-10 h-10 text-gray-600" />
          </div>
          <h4 className="text-base font-semibold text-gray-300">Your Seedr storage is empty</h4>
          <p className="text-xs text-gray-500 max-w-sm mt-1">
            Search for a torrent or paste a magnet link above to download files to your Seedr account.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/80">
          {files.map(item => {
            const isFolder = item.type === 'folder';
            const isExpanded = expandedFolders[item.id];
            const folderData = folderContents[item.id] || {};
            const isFolderLoading = folderData.loading;

            return (
              <div key={`${item.type}-${item.id}`} className="transition-colors">
                {/* Main Item Row */}
                <div 
                  className={`p-4 flex items-center justify-between gap-3 hover:bg-gray-800/40 transition-colors ${
                    isFolder ? 'cursor-pointer select-none' : ''
                  }`}
                  onClick={isFolder ? () => toggleFolder(item.id) : undefined}
                >
                  <div className="flex items-center gap-3.5 overflow-hidden flex-1">
                    {/* Expand Chevron (for folders) */}
                    {isFolder && (
                      <div className="text-gray-400 hover:text-gray-200 transition-transform">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    )}

                    {/* Icon */}
                    <div className="p-2.5 bg-gray-800 rounded-xl shrink-0 border border-gray-700/50">
                      {isFolder ? (
                        <Folder className="w-5 h-5 text-blue-400 fill-blue-400/20" />
                      ) : (
                        getFileIcon(item.name)
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="min-w-0 flex-1">
                      <div 
                        className="text-gray-100 font-semibold text-sm truncate flex items-center gap-2"
                        title={item.name}
                      >
                        <span>{item.name}</span>
                        {isFolder && (
                          <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Folder
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                        <span>{formatBytes(item.size)}</span>
                        {item.created && (
                          <span>• {new Date(item.created).toLocaleDateString()}</span>
                        )}
                        {isFolder && (
                          <span className="text-gray-400 hover:text-emerald-400 transition-colors">
                            • {isExpanded ? 'Click to collapse' : 'Click to explore files'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div 
                    className="flex items-center gap-1.5 pl-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!isFolder && (
                      <button
                        onClick={() => onDownload(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-emerald-300 bg-gray-800/80 hover:bg-emerald-500/10 rounded-xl border border-gray-700 hover:border-emerald-500/40 transition-colors"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteTarget({ id: item.id, name: item.name, type: item.type })}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                      title={`Delete ${item.type} from Seedr`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subfolder Contents (when expanded) */}
                {isFolder && isExpanded && (
                  <div className="bg-gray-950/50 pl-10 pr-4 py-2 border-t border-b border-gray-800/50">
                    {isFolderLoading ? (
                      <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Loading folder contents...</span>
                      </div>
                    ) : folderData.files && folderData.files.length > 0 ? (
                      <div className="divide-y divide-gray-800/40">
                        {folderData.files.map(nestedFile => (
                          <div 
                            key={nestedFile.id}
                            className="py-2.5 flex items-center justify-between gap-3 hover:bg-gray-800/30 px-2 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                              <div className="p-1.5 bg-gray-800/60 rounded-lg shrink-0">
                                {getFileIcon(nestedFile.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-gray-200 text-xs font-medium truncate" title={nestedFile.name}>
                                  {nestedFile.name}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {formatBytes(nestedFile.size)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => onDownload(nestedFile.id)}
                                className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                title="Download this file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ 
                                  id: nestedFile.id, 
                                  name: nestedFile.name, 
                                  type: 'file', 
                                  parentFolderId: item.id 
                                })}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete this file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 text-xs text-gray-500 italic">
                        This folder contains no downloadable files.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-100">
                  Delete {deleteTarget.type === 'folder' ? 'Folder' : 'File'}?
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to delete <span className="text-gray-200 font-semibold truncate block mt-0.5">"{deleteTarget.name}"</span>
                </p>
                <p className="text-xs text-red-400/80 mt-2 font-medium">
                  This action will permanently delete it from your Seedr cloud storage and free up space.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-950/40 transition-all disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
