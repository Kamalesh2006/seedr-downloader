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
  RefreshCw,
  FileCode2,
  HelpCircle,
  Radio
} from 'lucide-react';
import { formatBytes } from '../utils/magnet';
import VLCStreamModal, { VlcIcon } from './VLCStreamModal';
import { openInVLC, downloadM3UPlaylist, copyVLCStreamUrl, getDeviceInfo } from '../utils/vlc';

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
  const [isVlcModalOpen, setIsVlcModalOpen] = useState(false);
  const [vlcCopied, setVlcCopied] = useState(false);
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const device = getDeviceInfo();

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
      setVlcCopied(false);
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
      setIsVlcModalOpen(false);
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

  const streamUrlToUse = downloadUrl || hlsUrl;

  const handleCopyLink = () => {
    if (!streamUrlToUse) return;
    navigator.clipboard.writeText(streamUrlToUse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyVlcStream = async () => {
    if (!streamUrlToUse) return;
    const success = await copyVLCStreamUrl(streamUrlToUse);
    if (success) {
      setVlcCopied(true);
      setTimeout(() => setVlcCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    window.open(downloadUrl, '_blank');
  };

  const handleDirectLaunchVLC = () => {
    if (!streamUrlToUse) return;
    openInVLC(streamUrlToUse, fileName);
  };

  const handleDownloadM3U = () => {
    if (!streamUrlToUse) return;
    downloadM3UPlaylist(streamUrlToUse, fileName);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div 
          className="bg-[#111927] border border-[#1E293B] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#1E293B] bg-[#111927] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2.5 bg-[#00DF81]/10 text-[#00DF81] rounded-xl border border-[#00DF81]/20 shrink-0">
                {isVideo ? <Film className="w-5 h-5" /> : isAudio ? <Music className="w-5 h-5" /> : isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-base font-bold text-slate-100 truncate" title={fileName}>
                  {fileName}
                </h3>
                <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{formatBytes(file.size)}</span>
                  <span>•</span>
                  <span className="uppercase text-[#00DF81] font-semibold text-[10px] sm:text-[11px]">{ext || 'FILE'}</span>
                  {isHlsPlaying && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00DF81]/15 text-[#00DF81] border border-[#00DF81]/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> HLS Stream
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* VLC Stream Quick Button in Header */}
              {(isVideo || isAudio) && (
                <button
                  onClick={() => setIsVlcModalOpen(true)}
                  disabled={!streamUrlToUse}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-orange-400 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 transition-all disabled:opacity-50"
                  title="Open in VLC Media Player (Mobile / Desktop)"
                >
                  <VlcIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">VLC Stream</span>
                </button>
              )}

              <button
                onClick={handleCopyLink}
                disabled={!downloadUrl && !hlsUrl}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#182438] hover:bg-[#1E2E46] text-slate-200 hover:text-white border border-[#1E293B] transition-all disabled:opacity-50"
                title="Copy direct streaming link"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00DF81]" />
                    <span className="text-[#00DF81] font-medium hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                disabled={!downloadUrl || loadingUrl}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#071911] bg-[#00DF81] hover:bg-[#05D686] shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                title="Download file directly"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body / Media Content */}
          <div className="p-3 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-[#090F1C] min-h-[250px] sm:min-h-[300px]">
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
                        className="w-full h-full max-h-[58vh] object-contain"
                        onError={() => setVideoError(true)}
                      >
                        Your browser does not support HTML5 video streaming.
                      </video>
                    </div>

                    {/* Codec Warning Banner (if browser playback fails) */}
                    {videoError && (
                      <div className="mt-3 w-full p-4 bg-orange-950/40 border border-orange-700/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-orange-200">
                        <div className="flex items-start gap-2.5">
                          <VlcIcon className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-orange-300">
                              Browser format unsupported (MKV / AC3 / HEVC codec)
                            </p>
                            <p className="text-orange-200/80 text-[11px] mt-0.5">
                              This video format requires VLC Media Player for hardware-accelerated playback with full audio.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={handleDirectLaunchVLC}
                            className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-orange-950/40 transition-all active:scale-[0.98]"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play in VLC</span>
                          </button>
                          <button
                            onClick={() => setIsVlcModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 font-semibold text-xs transition-colors"
                          >
                            <span>VLC Guide</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* External Player & VLC Options Banner */}
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full bg-[#111A29] p-3 rounded-2xl border border-[#1E2B3E] text-xs">
                      <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="p-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <VlcIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-200">Stream in VLC Media Player</span>
                          <span className="text-[11px] text-slate-400 block sm:inline sm:ml-2">
                            Works on {device.osName} & VLC Network Stream
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {/* 1-Click Launch VLC */}
                        <button
                          onClick={handleDirectLaunchVLC}
                          disabled={!streamUrlToUse}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
                          title="Open directly in VLC app"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Open in VLC</span>
                        </button>

                        {/* Copy Stream Link for VLC Network Stream */}
                        <button
                          onClick={handleCopyVlcStream}
                          disabled={!streamUrlToUse}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#172338] hover:bg-[#1E2E46] text-slate-200 border border-[#1E293B] transition-colors disabled:opacity-50"
                          title="Copy direct stream link for VLC Network Stream (Ctrl+N / Cmd+N)"
                        >
                          {vlcCopied ? (
                            <>
                              <Check className="w-3 h-3 text-[#00DF81]" />
                              <span className="text-[#00DF81] font-semibold">Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-orange-400" />
                              <span>Copy Stream Link</span>
                            </>
                          )}
                        </button>

                        {/* Download .m3u Stream File (for Desktop) */}
                        {!device.isMobile && (
                          <button
                            onClick={handleDownloadM3U}
                            disabled={!streamUrlToUse}
                            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#172338] hover:bg-[#1E2E46] text-slate-300 border border-[#1E293B] transition-colors disabled:opacity-50"
                            title="Download lightweight .m3u stream playlist file"
                          >
                            <FileCode2 className="w-3 h-3 text-[#00DF81]" />
                            <span>.m3u File</span>
                          </button>
                        )}

                        {/* Full VLC Guide Modal */}
                        <button
                          onClick={() => setIsVlcModalOpen(true)}
                          className="inline-flex items-center gap-1 p-1.5 text-slate-400 hover:text-white bg-[#172338] hover:bg-[#1E2E46] rounded-xl border border-[#1E293B] transition-colors"
                          title="VLC Network Stream instructions and guide"
                        >
                          <HelpCircle className="w-4 h-4 text-slate-300" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Player */}
                {isAudio && (
                  <div className="w-full py-8 px-4 flex flex-col items-center justify-center max-w-lg bg-[#111A29] rounded-2xl border border-[#1E2B3E] shadow-xl">
                    <div className="p-4 bg-pink-500/10 text-pink-400 rounded-full mb-4 border border-pink-500/20">
                      <Music className="w-10 h-10 animate-bounce" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-200 text-center mb-4 truncate max-w-full">
                      {fileName}
                    </h4>
                    <audio controls className="w-full mb-4" src={downloadUrl}>
                      Your browser does not support HTML5 audio streaming.
                    </audio>

                    {/* VLC Stream option for audio */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#1E293B] w-full justify-center">
                      <button
                        onClick={handleDirectLaunchVLC}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 font-bold text-xs transition-colors"
                      >
                        <VlcIcon className="w-3.5 h-3.5" />
                        <span>Stream in VLC</span>
                      </button>
                      <button
                        onClick={() => setIsVlcModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#182335] hover:bg-slate-800 text-slate-300 border border-[#1E293B] text-xs transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Network Stream Options</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Image Viewer */}
                {isImage && (
                  <div className="w-full flex items-center justify-center p-2">
                    <img 
                      src={downloadUrl} 
                      alt={fileName} 
                      className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-2xl border border-[#1E293B]"
                    />
                  </div>
                )}

                {/* Document / Generic File */}
                {!isVideo && !isAudio && !isImage && (
                  <div className="py-10 px-6 text-center flex flex-col items-center justify-center max-w-md bg-[#111A29] rounded-2xl border border-[#1E293B]">
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
            <div className="px-4 sm:px-5 py-3.5 border-t border-[#1E293B] bg-[#111927] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0 bg-[#080E1A] px-3 py-1.5 rounded-xl border border-[#182335] text-xs font-mono text-gray-400">
                <span className="text-gray-500 select-none shrink-0">Stream URL:</span>
                <input 
                  type="text" 
                  readOnly 
                  value={downloadUrl || hlsUrl} 
                  className="bg-transparent text-gray-300 w-full focus:outline-none truncate select-all" 
                />
              </div>

              <div className="flex items-center gap-2 shrink-0 justify-end">
                <button
                  onClick={() => setIsVlcModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-orange-400 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 transition-colors"
                  title="Open VLC Network Stream Menu"
                >
                  <VlcIcon className="w-3.5 h-3.5" />
                  <span>VLC Stream</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#182335] hover:bg-slate-700 text-slate-200 hover:text-white border border-[#1E293B] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Link' : 'Copy'}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#00DF81] hover:bg-[#05D686] text-[#071911] font-bold transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VLC Stream & Network Stream Guide Modal */}
      <VLCStreamModal
        isOpen={isVlcModalOpen}
        onClose={() => setIsVlcModalOpen(false)}
        file={file}
        streamUrl={streamUrlToUse}
      />
    </>
  );
}
