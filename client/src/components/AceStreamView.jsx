import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  Radio, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  AlertCircle, 
  RefreshCw, 
  Server, 
  Terminal, 
  HelpCircle, 
  Trash2, 
  History, 
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { VlcIcon } from './VLCStreamModal';
import { openInVLC, downloadM3UPlaylist, copyVLCStreamUrl, getDeviceInfo } from '../utils/vlc';
import api from '../api/client';

const DEFAULT_SAMPLE_ID = '78aa92a70ef16a0e450d861243cc7a90e23aca42';
const STORAGE_KEY = 'seedr_acestream_history';

export default function AceStreamView({ initialId = '', onShowToast }) {
  const [streamId, setStreamId] = useState(initialId || '');
  const [activeStreamId, setActiveStreamId] = useState(initialId || '');
  const [streamTitle, setStreamTitle] = useState('AceStream Live');
  const [engineStatus, setEngineStatus] = useState({ loading: true, online: false, engineUrl: '' });
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  
  // Video Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);

  // History state
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [
        { id: DEFAULT_SAMPLE_ID, title: 'Sample Channel', addedAt: new Date().toISOString() }
      ];
    } catch {
      return [{ id: DEFAULT_SAMPLE_ID, title: 'Sample Channel', addedAt: new Date().toISOString() }];
    }
  });

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerContainerRef = useRef(null);
  const device = getDeviceInfo();

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history', e);
    }
  }, [history]);

  // Check Engine Status on mount
  const checkEngine = async () => {
    setEngineStatus(prev => ({ ...prev, loading: true }));
    try {
      const res = await api.get('/acestream/status');
      setEngineStatus({
        loading: false,
        online: !!res.data.online,
        engineUrl: res.data.engineUrl || 'http://127.0.0.1:6878',
        version: res.data.version || ''
      });
    } catch (err) {
      setEngineStatus({
        loading: false,
        online: false,
        engineUrl: 'http://127.0.0.1:6878',
        error: err.message
      });
    }
  };

  useEffect(() => {
    checkEngine();
  }, []);

  // Update stream ID if prop changes
  useEffect(() => {
    if (initialId) {
      setStreamId(initialId);
      handleStartStream(initialId);
    }
  }, [initialId]);

  // Sanitize helper
  const cleanId = (raw) => {
    if (!raw) return '';
    let val = raw.trim();
    if (val.startsWith('acestream://')) {
      val = val.replace(/^acestream:\/\//i, '').trim();
    }
    if (val.includes('=')) {
      const m = val.match(/(?:content_id|id|infohash)=([a-fA-F0-9]{40})/i);
      if (m) val = m[1];
    }
    return val.split('?')[0].replace(/^\/+|\/+$/g, '').toLowerCase();
  };

  const handleStartStream = (idToPlay = streamId) => {
    const sanitized = cleanId(idToPlay);
    if (!sanitized || !/^[a-fA-F0-9]{40}$/.test(sanitized)) {
      if (onShowToast) onShowToast('Please enter a valid 40-character Ace Stream ID', 'error');
      return;
    }

    setActiveStreamId(sanitized);
    setPlaybackError(null);
    setBuffering(true);

    // Add to history if not existing
    setHistory(prev => {
      const filtered = prev.filter(item => item.id !== sanitized);
      return [
        { id: sanitized, title: streamTitle || `Stream ${sanitized.substring(0, 8)}`, addedAt: new Date().toISOString() },
        ...filtered
      ].slice(0, 15);
    });

    if (onShowToast) onShowToast(`Connecting to Ace Stream ${sanitized.substring(0, 8)}...`, 'info');
  };

  // Setup HLS Player
  useEffect(() => {
    if (!activeStreamId || !videoRef.current) return;

    const videoEl = videoRef.current;
    const manifestUrl = `/api/acestream/hls/manifest.m3u8?id=${activeStreamId}`;

    setPlaybackError(null);
    setBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000
      });

      hlsRef.current = hls;
      hls.loadSource(manifestUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setBuffering(false);
        videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.WAITING, () => setBuffering(true));
      hls.on(Hls.Events.PLAYING, () => {
        setBuffering(false);
        setIsPlaying(true);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setBuffering(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlaybackError('Network connection to stream lost. Check if Ace Stream Engine is running.');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setPlaybackError('Failed to load stream. Ensure Ace Stream Engine is running and has active peers.');
              hls.destroy();
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      videoEl.src = manifestUrl;
      videoEl.addEventListener('loadedmetadata', () => {
        setBuffering(false);
        videoEl.play().catch(() => {});
      });
      videoEl.addEventListener('waiting', () => setBuffering(true));
      videoEl.addEventListener('playing', () => {
        setBuffering(false);
        setIsPlaying(true);
      });
      videoEl.addEventListener('error', () => {
        setBuffering(false);
        setPlaybackError('Failed to play stream on native player.');
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeStreamId]);

  // Video control helpers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Launch external player helpers
  const handleOpenNativeApp = () => {
    if (!activeStreamId) return;
    window.location.href = `acestream://${activeStreamId}`;
    if (onShowToast) onShowToast('Opening in Ace Stream Media Player...', 'success');
  };

  const handleOpenVLC = () => {
    if (!activeStreamId) return;
    const origin = window.location.origin;
    const directStreamUrl = `${origin}/api/acestream/stream?id=${activeStreamId}`;
    openInVLC(directStreamUrl, `acestream-${activeStreamId.substring(0, 8)}`);
    if (onShowToast) onShowToast('Launching VLC Media Player...', 'success');
  };

  const handleDownloadM3U = () => {
    if (!activeStreamId) return;
    window.location.href = `/api/acestream/playlist.m3u?id=${activeStreamId}&title=${encodeURIComponent(streamTitle)}`;
    if (onShowToast) onShowToast('M3U playlist downloaded', 'success');
  };

  const handleCopyLink = async () => {
    if (!activeStreamId) return;
    const origin = window.location.origin;
    const directStreamUrl = `${origin}/api/acestream/stream?id=${activeStreamId}`;
    const success = await copyVLCStreamUrl(directStreamUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      if (onShowToast) onShowToast('Stream link copied to clipboard!', 'success');
    }
  };

  const handleCopyDockerCmd = async () => {
    const cmd = 'docker run -d --name acestream-server --restart unless-stopped -p 6878:6878 -p 8621:8621 magnetikonline/acestream-server';
    await copyVLCStreamUrl(cmd);
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2500);
    if (onShowToast) onShowToast('Docker command copied to clipboard!', 'success');
  };

  const removeHistoryItem = (idToRemove) => {
    setHistory(prev => prev.filter(item => item.id !== idToRemove));
  };

  const isValidId = /^[a-fA-F0-9]{40}$/.test(cleanId(streamId));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#131E35] to-[#0A1224] border border-slate-800/80 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner shrink-0">
              <Radio className="w-7 h-7 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Ace Stream Live Player
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  P2P Broadcast
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                Stream live sports, events, and broadcast channels directly in your browser or via VLC using any 40-character Ace Stream Content ID.
              </p>
            </div>
          </div>

          {/* Engine Status Indicator */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {engineStatus.loading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                <span>Checking Engine...</span>
              </div>
            ) : engineStatus.online ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 shadow-sm shadow-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Engine Connected</span>
              </div>
            ) : (
              <button
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-300 transition-all"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Engine Offline &bull; Setup Guide</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSetupGuide ? 'rotate-180' : ''}`} />
              </button>
            )}

            <button
              onClick={checkEngine}
              title="Refresh Engine Status"
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${engineStatus.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Engine Offline / Setup Guide Drawer */}
        {showSetupGuide && (
          <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Server className="w-4 h-4" />
                <span>Ace Stream Engine Setup</span>
              </div>
              <span className="text-[11px] text-amber-400/80 font-mono">
                Port: 6878
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Ace Stream requires an Ace Stream Engine daemon running on your computer, Docker, or remote server to connect to P2P swarms.
            </p>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Quick Start with Docker:</span>
              </div>
              <div className="flex items-center gap-2 bg-[#060B14] p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                <code className="flex-1 select-all">
                  docker run -d --name acestream -p 6878:6878 -p 8621:8621 magnetikonline/acestream-server
                </code>
                <button
                  onClick={handleCopyDockerCmd}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs shrink-0 flex items-center gap-1"
                >
                  {copiedDocker ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDocker ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              💡 <em>Note:</em> You can still use the <strong>"Open in Ace Stream App"</strong> or <strong>"Open in VLC"</strong> buttons below to launch streams directly into external apps installed on your device.
            </p>
          </div>
        )}

        {/* Input Bar */}
        <div className="mt-6">
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartStream()}
                placeholder="Paste Ace Stream ID (e.g. 78aa92a70ef16a0e450d861243cc7a90e23aca42) or acestream://..."
                className="w-full bg-[#090F1C] border border-slate-800/90 focus:border-indigo-500 rounded-2xl px-4 py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
              />
              {streamId && (
                <button
                  onClick={() => setStreamId('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              onClick={() => handleStartStream()}
              disabled={!streamId.trim()}
              className={`px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                isValidId 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/25 scale-[1.01]' 
                  : 'bg-indigo-500/40 text-indigo-200/60 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Stream Live</span>
            </button>
          </div>

          {/* Quick presets / validation prompt */}
          <div className="flex items-center justify-between mt-2.5 px-1 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <span>Quick test:</span>
              <button
                onClick={() => {
                  setStreamId(DEFAULT_SAMPLE_ID);
                  handleStartStream(DEFAULT_SAMPLE_ID);
                }}
                className="font-mono text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1"
              >
                <span>{DEFAULT_SAMPLE_ID.substring(0, 10)}...</span>
                <Sparkles className="w-3 h-3 text-indigo-400" />
              </button>
            </div>

            {streamId && (
              <span className={isValidId ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                {isValidId ? '✓ Valid Ace Stream ID' : 'Must be a 40-character hex hash'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Player & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player Column */}
        <div className="lg:col-span-2 space-y-4">
          <div 
            ref={playerContainerRef}
            className="relative bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl aspect-video flex items-center justify-center group select-none"
          >
            {activeStreamId ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                  playsInline
                />

                {/* Buffering Indicator */}
                {buffering && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none z-20">
                    <div className="relative">
                      <Radio className="w-10 h-10 text-indigo-400 animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">Connecting to P2P Swarm...</p>
                      <p className="text-xs text-slate-400 mt-0.5">Fetching Ace Stream chunks via Engine</p>
                    </div>
                  </div>
                )}

                {/* Playback Error Overlay */}
                {playbackError && (
                  <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
                    <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
                    <h3 className="text-base font-bold text-white">Stream Playback Notice</h3>
                    <p className="text-xs text-slate-300 max-w-md mt-1 mb-4 leading-relaxed">
                      {playbackError}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={handleOpenNativeApp}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Launch in Ace Stream App</span>
                      </button>
                      <button
                        onClick={handleOpenVLC}
                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-600/30"
                      >
                        <VlcIcon className="w-4 h-4" />
                        <span>Play in VLC</span>
                      </button>
                      <button
                        onClick={() => handleStartStream()}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Badge */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/90 text-white text-[11px] font-black tracking-wider uppercase shadow-lg shadow-rose-600/40">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-slate-300 font-mono text-[10px] border border-white/10">
                    ID: {activeStreamId.substring(0, 8)}...
                  </span>
                </div>

                {/* Custom Overlay Controls */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between z-20">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>

                    <div className="flex items-center gap-2 text-white">
                      <button onClick={toggleMute} className="text-white hover:text-slate-300">
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 sm:w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title="Fullscreen"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
                <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800">
                  <Radio className="w-12 h-12 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300">No Stream Active</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter an Ace Stream ID above or select from your channel history.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stream Information & Multi-Platform Quick Bar */}
          {activeStreamId && (
            <div className="bg-[#0F172A] border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  Active Channel ID
                </span>
                <p className="font-mono text-xs sm:text-sm text-slate-200 truncate mt-0.5">
                  {activeStreamId}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={handleOpenNativeApp}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Launch Ace Stream native app"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Ace Player</span>
                </button>

                <button
                  onClick={handleOpenVLC}
                  className="px-3.5 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Open in VLC Media Player"
                >
                  <VlcIcon className="w-4 h-4" />
                  <span>VLC</span>
                </button>

                <button
                  onClick={handleDownloadM3U}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Download .m3u playlist"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>M3U</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Copy direct stream link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Channels & History Sidebar */}
        <div className="space-y-4">
          <div className="bg-[#0F172A] border border-slate-800/80 rounded-3xl p-5 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Recent Channels</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {history.length} saved
              </span>
            </div>

            <div className="mt-3 space-y-2 overflow-y-auto max-h-[480px] pr-1">
              {history.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No channels played yet.
                </div>
              ) : (
                history.map((item) => {
                  const isCurrent = activeStreamId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setStreamId(item.id);
                        handleStartStream(item.id);
                      }}
                      className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent 
                          ? 'bg-indigo-600/15 border-indigo-500/40 text-white' 
                          : 'bg-[#090F1C] border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${isCurrent ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Radio className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">
                            {item.title || `Stream ${item.id.substring(0, 8)}`}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                            {item.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHistoryItem(item.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remove from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
