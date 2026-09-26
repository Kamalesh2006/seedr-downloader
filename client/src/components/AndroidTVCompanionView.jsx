import React, { useState, useEffect, useCallback } from 'react';
import { 
  Tv, 
  Play, 
  Wifi, 
  Radio, 
  CheckCircle, 
  ArrowLeft, 
  Sparkles,
  ExternalLink,
  Film,
  Music,
  FileText,
  Sun,
  Moon,
  RefreshCw,
  Folder
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { VlcIcon } from './VLCStreamModal';
import { launchAndroidVlcIntent } from '../utils/vlc';
import { formatBytes } from '../utils/magnet';
import api from '../api/client';

export default function AndroidTVCompanionView({ isDarkMode, onToggleTheme }) {
  const [connected, setConnected] = useState(false);
  const [lastStream, setLastStream] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);

  const isDark = typeof isDarkMode === 'boolean' 
    ? isDarkMode 
    : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  // Calculate reachabile LAN URL so phones/tablets can open it across the home network
  const pairUrl = networkInfo?.localIp 
    ? `http://${networkInfo.localIp}:${window.location.port || '5175'}` 
    : window.location.origin;

  const fetchCompletedVideos = useCallback(() => {
    setLoadingFiles(true);
    api.get('/seedr/completed')
      .then(res => {
        setRecentFiles(res.data?.files || []);
      })
      .catch(() => {
        // Fallback to /seedr/folders if needed
        api.get('/seedr/folders')
          .then(res => {
            const files = (res.data?.files || []).filter(f => {
              const ext = f.name?.split('.').pop()?.toLowerCase();
              return ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'flv', 'ts', 'mp3'].includes(ext);
            });
            setRecentFiles(files);
          })
          .catch(() => {});
      })
      .finally(() => setLoadingFiles(false));
  }, []);

  // Connect to SSE for TV Remote Stream Events
  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource('/api/seedr/tv-events');
      
      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'launch-vlc' && data.url) {
            setLastStream(data);
            // Launch VLC Android TV app automatically
            launchAndroidVlcIntent(data.url);
          }
        } catch (err) {
          console.error('Error parsing TV event', err);
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
      };
    } catch (e) {
      console.error('EventSource failed', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Fetch TV network status and completed files
  useEffect(() => {
    api.get('/seedr/tv-status')
      .then(res => setNetworkInfo(res.data))
      .catch(() => {});

    fetchCompletedVideos();
  }, [fetchCompletedVideos]);

  const handlePlayOnVlc = async (file) => {
    try {
      const res = await api.get(`/seedr/download/${file.id}`);
      if (res.data?.url) {
        setLastStream({ name: file.name, url: res.data.url });
        launchAndroidVlcIntent(res.data.url);
      }
    } catch (e) {
      console.error('Failed to get stream url', e);
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      
      {/* TV Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <Link 
            to="/"
            className="p-3 bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-2xl transition-colors border border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-orange-500 outline-none shadow-sm"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/10 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400 rounded-2xl border border-orange-500/25 shrink-0">
              <VlcIcon className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>VLC Android TV Receiver</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 font-bold">
                  TV Companion Mode
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Ready to receive streams sent from your computer or smartphone
              </p>
            </div>
          </div>
        </div>

        {/* Live Status & Theme Controls */}
        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {/* Live Status Badge */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#0E1624] border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className={`w-3 h-3 rounded-full ${connected ? 'bg-[#00DF81] shadow-lg shadow-emerald-500/50 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
              {connected ? 'TV Connected & Ready' : 'Connecting to Server...'}
            </span>
          </div>

          {/* Inline Theme Toggle for TV Screen */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-sm focus:ring-4 focus:ring-orange-500 outline-none"
              title={isDark ? "Switch to Light Mode" : "Switch to Night Mode"}
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Status Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Live Receiver Status */}
        <div className="md:col-span-2 p-6 sm:p-8 rounded-3xl bg-white dark:bg-gradient-to-br dark:from-[#111927] dark:via-[#0E1625] dark:to-[#0A101D] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-2xl relative overflow-hidden flex flex-col justify-between transition-colors">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-[#00DF81] rounded-2xl border border-emerald-500/20">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Instant Wireless Playback</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Listening for "Open in VLC" triggers on your local network</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-slate-800/80 text-xs sm:text-sm space-y-2.5 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-[#00DF81] shrink-0" />
                <span>Keep this page open on your Android TV browser.</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-[#00DF81] shrink-0" />
                <span>Click <strong className="text-orange-600 dark:text-orange-400 font-bold">Open in VLC</strong> on your phone or PC.</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-[#00DF81] shrink-0" />
                <span>This TV will automatically launch VLC and begin streaming!</span>
              </div>
            </div>
          </div>

          {lastStream ? (
            <div className="mt-6 p-4 rounded-2xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                  Last Stream Triggered
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {lastStream.name || lastStream.fileName || 'Media Stream'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => launchAndroidVlcIntent(lastStream.url)}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/30 focus:ring-4 focus:ring-orange-400 transition-transform active:scale-95 shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Re-launch VLC</span>
              </button>
            </div>
          ) : (
            <div className="mt-6 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <span>Host IP: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{networkInfo?.localIp || 'Local network'}</strong></span>
            </div>
          )}
        </div>

        {/* Card 2: QR Code for Easy Pairing */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-2xl flex flex-col items-center justify-center text-center space-y-3 transition-colors">
          <div className="p-2.5 bg-orange-500/10 text-orange-500 dark:text-orange-400 rounded-2xl border border-orange-500/20">
            <Tv className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pair Phone / PC</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Scan to open Seedr Downloader on your phone or tablet
          </p>
          <div className="p-2 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pairUrl)}`}
              alt="Pairing QR Code"
              className="w-32 h-32 rounded-xl block"
            />
          </div>
          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate max-w-full bg-slate-100 dark:bg-black/30 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 select-all">
            {pairUrl}
          </span>
        </div>
      </div>

      {/* Quick Play Files for TV Remote Navigation */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-orange-500 shrink-0" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Play Completed Cloud Videos in VLC
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              {recentFiles.length} {recentFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchCompletedVideos}
              disabled={loadingFiles}
              className="p-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors focus:ring-2 focus:ring-orange-500 outline-none"
              title="Refresh cloud videos list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
              <span>Refresh Videos</span>
            </button>
            <span className="text-xs text-slate-500 hidden md:inline">
              Use your TV remote arrows to select and play
            </span>
          </div>
        </div>

        {loadingFiles ? (
          <div className="text-center py-8 text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
            <span>Loading cloud videos...</span>
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-sm">
            <Film className="w-8 h-8 text-slate-400 mx-auto stroke-[1.5]" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No completed video files in Cloud storage yet
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Add torrents or magnets from your phone or PC. Completed videos will show up here automatically!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {recentFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => handlePlayOnVlc(file)}
                className="p-4 rounded-2xl bg-white hover:bg-slate-50 dark:bg-[#111927] dark:hover:bg-[#172235] border border-slate-200 hover:border-orange-500/50 dark:border-slate-800 dark:hover:border-orange-500/60 text-left transition-all group focus:ring-4 focus:ring-orange-500 focus:outline-none flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="p-2 rounded-xl bg-orange-500/10 text-orange-500 dark:text-orange-400 border border-orange-500/20 group-hover:scale-110 transition-transform shrink-0">
                      <VlcIcon className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {file.size ? (file.size / (1024*1024*1024)).toFixed(1) + ' GB' : ''}
                    </span>
                  </div>

                  {file.folderName && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-full font-medium">
                      <Folder className="w-3 h-3 text-orange-500/70 shrink-0" />
                      <span className="truncate">{file.folderName}</span>
                    </span>
                  )}

                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-white line-clamp-2 transition-colors">
                    {file.name}
                  </h4>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-orange-600 dark:text-orange-400 font-bold">
                  <span>Open in VLC</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
