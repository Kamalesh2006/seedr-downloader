import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Film, 
  Music, 
  Image as ImageIcon, 
  FileText, 
  Loader2, 
  AlertCircle, 
  Play,
  Share2
} from 'lucide-react';
import { formatBytes } from '../utils/magnet';

export default function MediaPreviewModal({ 
  isOpen, 
  onClose, 
  file, 
  getDownloadUrl 
}) {
  const [downloadUrl, setDownloadUrl] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (isOpen && file && file.id) {
      setLoadingUrl(true);
      setUrlError(null);
      setVideoError(false);
      setCopied(false);

      getDownloadUrl(file.id)
        .then(url => {
          setDownloadUrl(url);
          setLoadingUrl(false);
        })
        .catch(err => {
          console.error('Failed to get download URL for preview', err);
          setUrlError(err.response?.data?.error || err.message || 'Failed to fetch direct download URL');
          setLoadingUrl(false);
        });
    } else {
      setDownloadUrl('');
      setLoadingUrl(false);
    }
  }, [isOpen, file, getDownloadUrl]);

  if (!isOpen || !file) return null;

  const fileName = file.name || 'File Preview';
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const isVideo = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'flv'].includes(ext);
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
  const isText = ['txt', 'srt', 'vtt', 'nfo', 'log', 'json', 'md'].includes(ext);

  const handleCopyLink = () => {
    if (!downloadUrl) return;
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-gray-900 border border-gray-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
              {isVideo ? <Film className="w-5 h-5" /> : isAudio ? <Music className="w-5 h-5" /> : isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-gray-100 truncate" title={fileName}>
                {fileName}
              </h3>
              <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                <span>{formatBytes(file.size)}</span>
                <span>•</span>
                <span className="uppercase text-emerald-400 font-semibold text-[11px]">{ext || 'FILE'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              disabled={!downloadUrl || loadingUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 transition-all disabled:opacity-50"
              title="Copy direct download link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!downloadUrl || loadingUrl}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/40 transition-all disabled:opacity-50"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-xl transition-colors"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Media Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-gray-950/70 min-h-[250px]">
          {loadingUrl ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm font-medium">Generating direct streaming link from Seedr...</span>
            </div>
          ) : urlError ? (
            <div className="py-12 text-center text-red-400 flex flex-col items-center gap-2 max-w-md">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <span className="text-sm font-semibold">{urlError}</span>
              <p className="text-xs text-gray-500 mt-1">Please make sure the file exists in your Seedr account.</p>
            </div>
          ) : downloadUrl ? (
            <div className="w-full flex flex-col items-center justify-center">
              {/* Video Player */}
              {isVideo && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 aspect-video flex items-center justify-center">
                    <video 
                      controls 
                      autoPlay={false}
                      className="w-full h-full max-h-[55vh] object-contain"
                      src={downloadUrl}
                      onError={() => setVideoError(true)}
                    >
                      Your browser does not support HTML5 video streaming.
                    </video>
                  </div>

                  {videoError && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 text-left w-full">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span>If your browser cannot decode this video codec ({ext?.toUpperCase()}), you can play it directly in VLC / IINA using the direct URL or download it.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Audio Player */}
              {isAudio && (
                <div className="w-full py-8 px-4 flex flex-col items-center justify-center max-w-lg bg-gray-900/80 rounded-2xl border border-gray-800 shadow-xl">
                  <div className="p-4 bg-pink-500/10 text-pink-400 rounded-full mb-4 border border-pink-500/20">
                    <Music className="w-10 h-10 animate-bounce" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-200 text-center mb-4 truncate max-w-full">
                    {fileName}
                  </h4>
                  <audio controls className="w-full" src={downloadUrl}>
                    Your browser does not support HTML5 audio streaming.
                  </audio>
                </div>
              )}

              {/* Image Viewer */}
              {isImage && (
                <div className="w-full flex items-center justify-center p-2">
                  <img 
                    src={downloadUrl} 
                    alt={fileName} 
                    className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-2xl border border-gray-800"
                  />
                </div>
              )}

              {/* Document / Generic File */}
              {!isVideo && !isAudio && !isImage && (
                <div className="py-10 px-6 text-center flex flex-col items-center justify-center max-w-md bg-gray-900/60 rounded-2xl border border-gray-800">
                  <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-4 border border-emerald-500/20">
                    <FileText className="w-10 h-10" />
                  </div>
                  <h4 className="text-base font-bold text-gray-100 mb-1">{fileName}</h4>
                  <p className="text-xs text-gray-400 mb-5">
                    Ready to download ({formatBytes(file.size)})
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold text-xs shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File ({formatBytes(file.size)})</span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Footer with Direct Link Box */}
        {downloadUrl && (
          <div className="px-5 py-3.5 border-t border-gray-800 bg-gray-900/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-gray-950 px-3 py-1.5 rounded-xl border border-gray-800 text-xs font-mono text-gray-400">
              <span className="text-gray-500 select-none shrink-0">Direct Link:</span>
              <input 
                type="text" 
                readOnly 
                value={downloadUrl} 
                className="bg-transparent text-gray-300 w-full focus:outline-none truncate select-all" 
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-end">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Link' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
