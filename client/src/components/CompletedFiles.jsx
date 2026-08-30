import React, { useState } from 'react';
import { 
  Folder, 
  File, 
  Download, 
  Trash2, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown, 
  Film, 
  Clapperboard,
  Music, 
  Archive, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  AlertTriangle, 
  Play, 
  Copy, 
  Check, 
  Eye, 
  Activity,
  MoreVertical
} from 'lucide-react';
import { formatBytes, formatRelativeTime } from '../utils/magnet';
import MediaPreviewModal from './MediaPreviewModal';
import FileActionSheet from './FileActionSheet';

function getFileIcon(fileName) {
  if (!fileName) return <File className="w-5 h-5 text-slate-400" />;
  const ext = fileName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'flv':
    case 'm4v':
    case 'ts':
      return <Clapperboard className="w-5 h-5 text-sky-400" />;
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
      return <File className="w-5 h-5 text-slate-400" />;
  }
}

export default function CompletedFiles({ 
  files = [], 
  activeTorrents = [],
  storage = { spaceUsed: 0, spaceMax: 0 },
  folderContents = {},
  loading = false,
  onRefresh,
  onFetchFolder,
  onDownload, 
  onDelete, 
  getDownloadUrl 
}) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Media Preview Modal state
  const [previewFile, setPreviewFile] = useState(null);
  const [copiedFileId, setCopiedFileId] = useState(null);

  // Mobile Action Sheet state
  const [selectedMobileFile, setSelectedMobileFile] = useState(null);

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

  const handleCopyLink = async (e, fileId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!getDownloadUrl) return;
    try {
      const url = await getDownloadUrl(fileId);
      if (url) {
        await navigator.clipboard.writeText(url);
        setCopiedFileId(fileId);
        setTimeout(() => setCopiedFileId(null), 2500);
      }
    } catch (err) {
      console.error('Failed to copy download link', err);
    }
  };

  const handleOpenPreview = (item) => {
    setPreviewFile(item);
  };

  const handleItemClick = (item) => {
    if (item.type === 'folder') {
      toggleFolder(item.id);
    } else {
      // If mobile, open preview or action sheet
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setSelectedMobileFile(item);
      } else {
        handleOpenPreview(item);
      }
    }
  };

  const totalItemsCount = files.length + activeTorrents.length;

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Files in Seedr Cloud
          </h3>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-[#1E293B] transition-all disabled:opacity-50"
            title="Refresh files"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00DF81]' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Syncing...' : 'Refresh'}</span>
          </button>
        )}
      </div>

      {/* Files List Container */}
      <div className="bg-[#111927] rounded-2xl border border-[#1E293B] overflow-hidden shadow-lg shadow-black/20">
        {totalItemsCount === 0 ? (
          <div className="p-10 sm:p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <div className="p-4 bg-[#141D2E] rounded-2xl mb-3 border border-[#1E293B]">
              <Folder className="w-8 h-8 sm:w-10 sm:h-10 text-slate-600" />
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-slate-300">Your Seedr cloud is empty</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Search for a torrent or paste a magnet link above to download files to your Seedr account.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E293B]/70">
            {/* Active Downloading Cloud Torrents in Seedr */}
            {activeTorrents.map(torrent => (
              <div 
                key={`torrent-${torrent.id}`} 
                className="p-3.5 sm:p-4 bg-amber-500/5 hover:bg-amber-500/10 transition-colors flex items-center justify-between gap-3 border-l-4 border-amber-500"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <div className="p-2.5 bg-amber-500/10 rounded-xl shrink-0 border border-amber-500/20 text-amber-400">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-100 font-semibold text-xs sm:text-sm truncate" title={torrent.name}>
                      {torrent.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{formatBytes(torrent.size)}</span>
                      <span>•</span>
                      <span className="text-amber-400 font-medium">Downloading {torrent.progress || 0}%</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setDeleteTarget({ id: torrent.id, name: torrent.name, type: 'torrent' })}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                  title="Cancel & delete torrent"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Folders and Files */}
            {files.map(item => {
              const isFolder = item.type === 'folder';
              const isExpanded = expandedFolders[item.id];
              const folderData = folderContents[item.id] || {};
              const isFolderLoading = folderData.loading;
              const isCopied = copiedFileId === item.id;
              const relativeTimeStr = formatRelativeTime(item.created || item.last_update);

              return (
                <div key={`${item.type}-${item.id}`} className="group/row transition-colors">
                  {/* Main File/Folder Item Row */}
                  <div 
                    onClick={() => handleItemClick(item)}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#152033] transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5 overflow-hidden flex-1">
                      {/* Icon Container */}
                      <div className="p-2.5 sm:p-3 bg-[#151F32] rounded-xl sm:rounded-2xl shrink-0 border border-[#1E293B] flex items-center justify-center">
                        {isFolder ? (
                          <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-[#00DF81]" />
                        ) : (
                          getFileIcon(item.name)
                        )}
                      </div>

                      {/* File Info */}
                      <div className="min-w-0 flex-1">
                        <div 
                          className="text-slate-100 font-semibold text-xs sm:text-sm truncate group-hover/row:text-[#00DF81] transition-colors"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span className="font-mono">{formatBytes(item.size)}</span>
                          <span>•</span>
                          <span>{relativeTimeStr}</span>
                          {isFolder && (
                            <span className="text-[#00DF81] ml-1 font-medium hidden sm:inline">
                              • {isExpanded ? 'Collapse' : 'Explore'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div 
                      className="flex items-center gap-1 sm:gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Mobile 3-dots Menu Button */}
                      <button
                        onClick={() => setSelectedMobileFile(item)}
                        className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        title="Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Desktop Actions */}
                      <div className="hidden md:flex items-center gap-1.5">
                        {!isFolder && (
                          <>
                            <button
                              onClick={() => handleOpenPreview(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-[#00DF81] bg-[#162238] hover:bg-[#00DF81]/10 rounded-xl border border-[#1E293B] hover:border-[#00DF81]/40 transition-colors"
                              title="View / Stream"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#00DF81]" />
                              <span>View</span>
                            </button>

                            <button
                              onClick={(e) => handleCopyLink(e, item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-[#162238] hover:bg-slate-700 rounded-xl border border-[#1E293B] transition-colors"
                              title="Copy direct download link"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#00DF81]" />
                                  <span className="text-[#00DF81]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => onDownload(item.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#071911] bg-[#00DF81] hover:bg-[#05D686] rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                              title="Direct download"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setDeleteTarget({ id: item.id, name: item.name, type: item.type })}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                          title={`Delete ${item.type} from Seedr`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Folder Chevron */}
                      {isFolder && (
                        <div 
                          className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                          onClick={() => toggleFolder(item.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#00DF81]" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subfolder Contents */}
                  {isFolder && isExpanded && (
                    <div className="bg-[#090F1C] pl-6 sm:pl-10 pr-3 sm:pr-4 py-2 border-t border-b border-[#1E293B]/60 animate-in fade-in duration-200">
                      {isFolderLoading ? (
                        <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin text-[#00DF81]" />
                          <span>Loading folder contents...</span>
                        </div>
                      ) : folderData.files && folderData.files.length > 0 ? (
                        <div className="divide-y divide-[#1E293B]/40">
                          {folderData.files.map(nestedFile => {
                            const isNestedCopied = copiedFileId === nestedFile.id;
                            const nestedTime = formatRelativeTime(nestedFile.created || nestedFile.last_update);

                            return (
                              <div 
                                key={nestedFile.id}
                                className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#141D2E] px-2 rounded-xl transition-colors cursor-pointer select-none group/nested"
                                onClick={() => handleItemClick(nestedFile)}
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                                  <div className="p-1.5 bg-[#162032] rounded-lg shrink-0 border border-[#1E293B]">
                                    {getFileIcon(nestedFile.name)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-slate-200 text-xs font-medium truncate group-hover/nested:text-[#00DF81] transition-colors" title={nestedFile.name}>
                                      {nestedFile.name}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                      <span className="font-mono">{formatBytes(nestedFile.size)}</span>
                                      <span>•</span>
                                      <span>{nestedTime}</span>
                                    </div>
                                  </div>
                                </div>

                                <div 
                                  className="flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Mobile 3 dots */}
                                  <button
                                    onClick={() => setSelectedMobileFile(nestedFile)}
                                    className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Desktop inline */}
                                  <div className="hidden md:flex items-center gap-1">
                                    <button
                                      onClick={() => handleOpenPreview(nestedFile)}
                                      className="p-1.5 text-slate-300 hover:text-[#00DF81] bg-[#182438] rounded-lg transition-colors border border-[#1E293B]"
                                      title="Stream / View"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#00DF81]" />
                                    </button>

                                    <button
                                      onClick={(e) => handleCopyLink(e, nestedFile.id)}
                                      className="p-1.5 text-slate-300 hover:text-white bg-[#182438] rounded-lg transition-colors border border-[#1E293B]"
                                      title="Copy direct download link"
                                    >
                                      {isNestedCopied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>

                                    <button
                                      onClick={() => onDownload(nestedFile.id)}
                                      className="px-2.5 py-1 text-xs font-bold text-[#071911] bg-[#00DF81] hover:bg-[#05D686] rounded-lg shadow-sm"
                                      title="Download file"
                                    >
                                      <Download className="w-3 h-3" />
                                    </button>

                                    <button
                                      onClick={() => setDeleteTarget({ 
                                        id: nestedFile.id, 
                                        name: nestedFile.name, 
                                        type: 'file', 
                                        parentFolderId: item.id 
                                      })}
                                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                      title="Delete file"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-2 text-xs text-slate-500 italic">
                          This folder is empty.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* In-App Media Viewer Modal */}
      <MediaPreviewModal 
        isOpen={!!previewFile}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        getDownloadUrl={getDownloadUrl}
      />

      {/* Mobile Touch Action Sheet */}
      <FileActionSheet 
        isOpen={!!selectedMobileFile}
        file={selectedMobileFile}
        onClose={() => setSelectedMobileFile(null)}
        onStream={handleOpenPreview}
        onDownload={onDownload}
        onCopyLink={handleCopyLink}
        isCopied={copiedFileId === selectedMobileFile?.id}
        onDelete={(file) => setDeleteTarget({ id: file.id, name: file.name, type: file.type || 'file' })}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-[#111927] border border-[#1E293B] w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-100">
                  Delete {deleteTarget.type === 'folder' ? 'Folder' : deleteTarget.type === 'torrent' ? 'Downloading Torrent' : 'File'}?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete <span className="text-slate-200 font-semibold truncate block mt-0.5">"{deleteTarget.name}"</span>
                </p>
                <p className="text-xs text-red-400/80 mt-2 font-medium">
                  This action will permanently delete it and free up Seedr storage space.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1E293B]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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
