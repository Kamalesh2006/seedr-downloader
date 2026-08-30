import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
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
  Tv,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { formatBytes } from '../utils/magnet';

export default function MediaPreviewModal({ 
  isOpen, 
  onClose, 
  file, 
  getDownloadUrl 
}) {
  const [downloadUrl, setDownloadUrl] = useState('');
  const [hlsUrl, setHlsUrl] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isHlsPlaying, setIsHlsPlaying] = useState(false);
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const fileName = file?.name || 'File Preview';
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const isVideo = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'flv', 'ts'].includes(ext);
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
  const isText = ['txt', 'srt', 'vtt', 'nfo', 'log', 'json', 'md'].includes(ext);

  // Fetch download and stream URLs
  useEffect(() => {
    if (isOpen && file && file.id) {
      setLoadingUrl(true);
      setUrlError(null);
      setVideoError(false);
      setCopied(false);
      setIsHlsPlaying(false);

      // Check if file already has an HLS stream from folder listing
      const existingHls = file.hlsUrl || file.presentation_urls?.video?.hls || '';
      if (existingHls) {
        setHlsUrl(existingHls);
      } else {
        setHlsUrl('');
      }

      getDownloadUrl(file.id)
        .then(url => {
          setDownloadUrl(url);
          setLoadingUrl(false);
        })
        .catch(err => {
          console.error('Failed to get download URL for preview', err);
          setUrlError(err.response?.data?.error || err.message || 'Failed to fetch direct streaming URL');
          setLoadingUrl(false);
        });
    } else {
      setDownloadUrl('');
      setHlsUrl('');
      setLoadingUrl(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }
  }, [isOpen, file, getDownloadUrl]);

  // Attach HLS stream to video element
  useEffect(() => {
    if (!isOpen || !isVideo || !videoRef.current) return;

    const videoEl = videoRef.current;
    const streamSource = hlsUrl || (downloadUrl && ext === 'mp4' ? downloadUrl : '');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (hlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsHlsPlaying(true);
        videoEl.play().catch(() => {
          // Autoplay was prevented, wait for user interaction
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS Stream error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setIsHlsPlaying(false);
              // Fallback to direct URL if available
              if (downloadUrl) {
                videoEl.src = downloadUrl;
              } else {
                setVideoError(true);
              }
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (hlsUrl && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      videoEl.src = hlsUrl;
      setIsHlsPlaying(true);
      videoEl.play().catch(() => {});
    } else if (downloadUrl) {
      // Direct video stream
      videoEl.src = downloadUrl;
      setIsHlsPlaying(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, isVideo, hlsUrl, downloadUrl, ext]);

  if (!isOpen || !file) return null;

  const handleCopyLink = () => {
    const urlToCopy = downloadUrl || hlsUrl;
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    window.open(downloadUrl, '_blank');
  };

  const handleOpenVLC = () => {
    if (!downloadUrl) return;
    // VLC / IINA custom protocol handler
    window.location.href = `vlc://${downloadUrl}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-gray-900 border border-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/95 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
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
                {isHlsPlaying && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> HLS Web Stream
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              disabled={!downloadUrl && !hlsUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 transition-all disabled:opacity-50"
              title="Copy direct streaming link"
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
              title="Download file directly"
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-gray-950/80 min-h-[300px]">
          {loadingUrl && !hlsUrl ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm font-medium">Initializing stream player from Seedr...</span>
            </div>
          ) : urlError ? (
            <div className="py-12 text-center text-red-400 flex flex-col items-center gap-2 max-w-md">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <span className="text-sm font-semibold">{urlError}</span>
              <p className="text-xs text-gray-500 mt-1">Please make sure the file exists in your Seedr account.</p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center justify-center">
              {/* Video Player */}
              {isVideo && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 aspect-video flex items-center justify-center relative group">
                    <video 
                      ref={videoRef}
                      controls 
                      playsInline
                      crossOrigin="anonymous"
                      className="w-full h-full max-h-[60vh] object-contain"
                      onError={() => setVideoError(true)}
                    >
                      Your browser does not support HTML5 video streaming.
                    </video>
                  </div>

                  {/* Fallback / External Player Option */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 w-full bg-gray-900/60 p-3 rounded-xl border border-gray-800 text-xs">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Tv className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Prefer watching on a native desktop player?</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOpenVLC}
                        disabled={!downloadUrl}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
                        title="Stream in VLC Media Player"
                      >
                        <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Stream in VLC</span>
                      </button>

                      <button
                        onClick={handleCopyLink}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
                        title="Copy direct stream URL"
                      >
                        <Copy className="w-3 h-3 text-emerald-400" />
                        <span>Copy Stream URL</span>
                      </button>
                    </div>
                  </div>
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
          )}
        </div>

        {/* Modal Footer with Direct Link Box */}
        {(downloadUrl || hlsUrl) && (
          <div className="px-5 py-3.5 border-t border-gray-800 bg-gray-900/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-gray-950 px-3 py-1.5 rounded-xl border border-gray-800 text-xs font-mono text-gray-400">
              <span className="text-gray-500 select-none shrink-0">Direct Link:</span>
              <input 
                type="text" 
                readOnly 
                value={downloadUrl || hlsUrl} 
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
