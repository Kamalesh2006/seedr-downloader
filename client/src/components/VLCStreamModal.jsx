import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Monitor, 
  Smartphone, 
  Tv, 
  Radio,
  FileCode2,
  Wifi,
  Cast,
  QrCode,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  openInVLC, 
  downloadM3UPlaylist, 
  copyVLCStreamUrl, 
  getDeviceInfo, 
  streamToAndroidTv,
  testAndroidTvConnection,
  getSavedAndroidTvIp,
  setSavedAndroidTvIp,
  getSavedVlcTarget,
  setSavedVlcTarget
} from '../utils/vlc';

// VLC Traffic Cone SVG Icon
export function VlcIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L9 9H15L12 2Z" fill="#F97316" />
      <path d="M8.5 10L7 14H17L15.5 10H8.5Z" fill="#F8FAFC" />
      <path d="M6.5 15L4.5 19H19.5L17.5 15H6.5Z" fill="#F97316" />
      <path d="M3 20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20H3Z" fill="#EA580C" />
      <circle cx="12" cy="5" r="1.5" fill="#FED7AA" />
    </svg>
  );
}

export default function VLCStreamModal({
  isOpen,
  onClose,
  file,
  streamUrl
}) {
  const [copied, setCopied] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [tvIp, setTvIp] = useState('');
  const [targetDevice, setTargetDevice] = useState('device');
  const [testingTv, setTestingTv] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [tvStreaming, setTvStreaming] = useState(false);
  const [tvStatusMsg, setTvStatusMsg] = useState('');
  const [alwaysTv, setAlwaysTv] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [guideTab, setGuideTab] = useState('android-tv');

  const device = getDeviceInfo();
  const fileName = file?.name || 'Media Stream';
  const urlToUse = streamUrl || file?.hlsUrl || '';

  useEffect(() => {
    if (isOpen) {
      const savedIp = getSavedAndroidTvIp();
      const savedTarget = getSavedVlcTarget();
      setTvIp(savedIp);
      setTargetDevice(device.isAndroidTV ? 'device' : (savedTarget || 'device'));
      setAlwaysTv(savedTarget === 'android-tv');
      setGuideTab(device.isAndroidTV ? 'android-tv' : (savedTarget === 'android-tv' ? 'android-tv' : 'desktop'));
    }
  }, [isOpen, device.isAndroidTV]);

  if (!isOpen || !file) return null;

  const handleCopy = async () => {
    if (!urlToUse) return;
    const success = await copyVLCStreamUrl(urlToUse);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSaveTvIp = (val) => {
    setTvIp(val);
    setSavedAndroidTvIp(val);
    setTestResult(null);
  };

  const handleToggleAlwaysTv = (e) => {
    const checked = e.target.checked;
    setAlwaysTv(checked);
    const newTarget = checked ? 'android-tv' : 'device';
    setTargetDevice(newTarget);
    setSavedVlcTarget(newTarget);
  };

  const handleTargetChange = (target) => {
    setTargetDevice(target);
    setSavedVlcTarget(target);
    if (target === 'android-tv') {
      setGuideTab('android-tv');
    }
  };

  const handleTestTv = async () => {
    if (!tvIp.trim()) {
      setTestResult({ success: false, message: 'Enter your Android TV IP first' });
      return;
    }
    setTestingTv(true);
    setTestResult(null);
    try {
      const res = await testAndroidTvConnection(tvIp.trim());
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, message: 'Could not connect to TV' });
    } finally {
      setTestingTv(false);
    }
  };

  const handleStreamToAndroidTv = async () => {
    if (!urlToUse) return;
    setTvStreaming(true);
    setTvStatusMsg('Connecting and opening in Android TV VLC...');
    try {
      const res = await streamToAndroidTv(urlToUse, tvIp.trim(), fileName);
      setTvStatusMsg(res.message || 'Stream sent to Android TV VLC!');
      setTimeout(() => {
        setTvStreaming(false);
        setTvStatusMsg('');
      }, 5000);
    } catch (e) {
      setTvStatusMsg('Error sending to Android TV');
      setTvStreaming(false);
    }
  };

  const handleLaunch = async () => {
    if (!urlToUse) return;
    setLaunched(true);
    await openInVLC(urlToUse, fileName, { target: targetDevice, tvIp: tvIp.trim() });
    setTimeout(() => setLaunched(false), 4000);
  };

  const handleDownloadM3U = () => {
    if (!urlToUse) return;
    downloadM3UPlaylist(urlToUse, fileName);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with VLC Theme */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1E293B] bg-gradient-to-r from-orange-50/80 via-white to-amber-50/60 dark:from-[#172338] dark:via-[#111927] dark:to-[#1e1915] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-2xl border border-orange-500/20 shadow-inner shrink-0">
              <VlcIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  Stream in VLC Media Player
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 shrink-0">
                  {device.isAndroidTV ? '📺 Android TV' : device.osName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {fileName}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 bg-slate-50/60 dark:bg-[#0A101D]">
          
          {/* Target Device Selector Bar */}
          {!device.isAndroidTV && (
            <div className="p-1.5 rounded-2xl bg-slate-200/70 dark:bg-[#131D2F] border border-slate-300/60 dark:border-[#1E293B] flex items-center justify-between gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => handleTargetChange('device')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  targetDevice === 'device'
                    ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4 text-orange-500" />
                <span>This Device ({device.osName})</span>
              </button>

              <button
                type="button"
                onClick={() => handleTargetChange('android-tv')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  targetDevice === 'android-tv'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>Android TV (VLC)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20 uppercase font-black">
                  Remote
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTargetChange('both')}
                className={`hidden sm:flex py-2 px-3 rounded-xl text-xs font-bold items-center justify-center gap-1.5 transition-all ${
                  targetDevice === 'both'
                    ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Cast className="w-3.5 h-3.5 text-emerald-400" />
                <span>Both</span>
              </button>
            </div>
          )}

          {/* SECTION: ANDROID TV CONFIG & REMOTE LAUNCH */}
          {(targetDevice === 'android-tv' || targetDevice === 'both' || device.isAndroidTV) && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent dark:from-orange-950/30 dark:via-[#131D2F] dark:to-[#0E1624] border border-orange-500/30 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-orange-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/30">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Stream directly to Android TV</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 font-semibold">
                        VLC Media Player
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {device.isAndroidTV 
                        ? 'You are running on Android TV. Click Launch to open VLC!' 
                        : 'Streams video to your Android TV VLC application over Wi-Fi'}
                    </p>
                  </div>
                </div>

                {!device.isAndroidTV && (
                  <button
                    type="button"
                    onClick={() => setShowQr(!showQr)}
                    className="self-start sm:self-auto px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-sm hover:border-orange-500/50 transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-orange-500" />
                    <span>{showQr ? 'Hide TV QR' : 'TV QR Code'}</span>
                  </button>
                )}
              </div>

              {/* QR Code Container if toggled */}
              {showQr && (
                <div className="p-4 rounded-xl bg-white dark:bg-[#0A101D] border border-orange-500/20 flex flex-col items-center justify-center space-y-2 text-center animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Scan with Android TV Camera or Phone to Stream
                  </p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(urlToUse)}`}
                    alt="VLC Stream QR Code"
                    className="w-36 h-36 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 bg-white shadow-sm"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                    Point your TV QR scanner or phone camera at this QR code to stream directly into VLC.
                  </p>
                </div>
              )}

              {/* IP Input & Test (for remote launch from PC / phone) */}
              {!device.isAndroidTV && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Wifi className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Enter Android TV IP (e.g. 192.168.1.50)"
                        value={tvIp}
                        onChange={(e) => handleSaveTvIp(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#080D17] border border-slate-300 dark:border-[#1E293B] text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 transition-colors shadow-inner"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleTestTv}
                      disabled={testingTv || !tvIp.trim()}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#2A3952] text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {testingTv ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>

                  {/* Test Result Message */}
                  {testResult && (
                    <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      testResult.success 
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-[#00DF81] border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                    }`}>
                      {testResult.success ? <Check className="w-4 h-4 shrink-0 text-[#00DF81]" /> : <Info className="w-4 h-4 shrink-0 text-amber-400" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  {/* Checkbox: Always play on Android TV */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="alwaysTvCheck"
                      checked={alwaysTv}
                      onChange={handleToggleAlwaysTv}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                    />
                    <label htmlFor="alwaysTvCheck" className="text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer select-none">
                      Always open on Android TV when clicking <strong className="text-slate-900 dark:text-white">Open in VLC</strong>
                    </label>
                  </div>
                </div>
              )}

              {/* Status Message */}
              {tvStatusMsg && (
                <div className="p-3 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-700 dark:text-orange-300 text-xs font-semibold animate-pulse flex items-center gap-2">
                  <VlcIcon className="w-4 h-4 shrink-0" />
                  <span>{tvStatusMsg}</span>
                </div>
              )}

              {/* Main Android TV Launch Button */}
              <button
                type="button"
                onClick={device.isAndroidTV ? handleLaunch : handleStreamToAndroidTv}
                disabled={tvStreaming || launched}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                <Tv className="w-4 h-4" />
                <span>
                  {tvStreaming 
                    ? 'Launching on Android TV VLC...' 
                    : launched 
                    ? 'Opening in VLC...' 
                    : device.isAndroidTV 
                    ? 'Launch VLC on this Android TV' 
                    : 'Stream to VLC on Android TV'}
                </span>
                <Play className="w-3.5 h-3.5 fill-current ml-1" />
              </button>
            </div>
          )}

          {/* Main Action Grid (Device Playback & M3U) */}
          {targetDevice !== 'android-tv' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Action 1: Launch VLC App */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#131D2F] border border-slate-200 dark:border-[#1E293B] shadow-sm hover:border-orange-500/50 dark:hover:border-orange-500/40 hover:shadow-md transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                      <Play className="w-4 h-4 fill-current" />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {device.isMobile ? 'Mobile App' : 'Protocol Launch'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    1. Launch VLC App
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {device.isMobile 
                      ? `Directly opens the stream inside your ${device.osName} VLC application.` 
                      : 'Launches desktop VLC directly via vlc:// protocol handler.'}
                  </p>
                </div>

                <button
                  onClick={handleLaunch}
                  className="mt-4 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 dark:shadow-orange-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{launched ? 'Opening VLC...' : 'Open in VLC App'}</span>
                </button>
              </div>

              {/* Action 2: Download .m3u Playlist */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#131D2F] border border-slate-200 dark:border-[#1E293B] shadow-sm hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-[#00DF81] border border-emerald-500/20">
                      <FileCode2 className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-[#00DF81]">
                      Recommended for PC/Mac
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-[#00DF81] transition-colors">
                    2. Download .m3u Playlist
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    1-click instant stream file. Double-clicking it opens VLC on desktop without downloading the video.
                  </p>
                </div>

                <button
                  onClick={handleDownloadM3U}
                  className="mt-4 w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-[#18263B] dark:hover:bg-[#1E304B] dark:text-[#00DF81] dark:hover:text-white border border-emerald-200 dark:border-[#233550] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .m3u Stream File</span>
                </button>
              </div>
            </div>
          )}

          {/* Stream Link Box */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1624] border border-slate-200 dark:border-[#1E293B] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-200">
                <Radio className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                <span>Direct Network Stream URL</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Ready for VLC Network Stream</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#080D17] p-1.5 pl-3 rounded-xl border border-slate-200 dark:border-[#182335]">
              <input
                type="text"
                readOnly
                value={urlToUse}
                className="bg-transparent text-xs text-slate-800 dark:text-slate-300 w-full focus:outline-none font-mono truncate select-all"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 dark:border-orange-500/30 font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00DF81]" />
                    <span className="text-[#00DF81]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* VLC Network Stream Step-by-Step Instructions */}
          <div className="rounded-2xl bg-white dark:bg-[#0E1624] border border-slate-200 dark:border-[#1E293B] shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-[#141D2D] border-b border-slate-200 dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-orange-500" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-200">
                  How to stream in VLC
                </h4>
              </div>

              {/* Device Tabs */}
              <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-[#0B111D] rounded-lg border border-slate-300/60 dark:border-[#1E293B]">
                <button
                  onClick={() => setGuideTab('android-tv')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    guideTab === 'android-tv' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Tv className="w-3 h-3" />
                  <span>Android TV</span>
                </button>
                <button
                  onClick={() => setGuideTab('desktop')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    guideTab === 'desktop' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Monitor className="w-3 h-3" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setGuideTab('mobile')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    guideTab === 'mobile' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Mobile App</span>
                </button>
              </div>
            </div>

            <div className="p-4 text-xs space-y-3">
              {guideTab === 'android-tv' ? (
                <ol className="space-y-2.5 text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      <strong className="text-slate-900 dark:text-white">Method A (1-Click Remote Launch):</strong> Enter your Android TV IP address above (find it in TV <em>Settings &gt; Network &gt; Wi-Fi</em>) and click <strong className="text-orange-600 dark:text-orange-400">Stream to VLC on Android TV</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      <strong className="text-slate-900 dark:text-white">Method B (In VLC for Android TV App):</strong> Open <strong className="text-slate-900 dark:text-white">VLC</strong> on your Android TV, navigate to <strong className="text-slate-900 dark:text-white">Streams</strong> or <strong className="text-slate-900 dark:text-white">Network Stream</strong> on the sidebar, and paste/enter the stream URL.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      <strong className="text-slate-900 dark:text-white">Method C (Using TV Browser):</strong> Open this web app directly on your Android TV browser (TV Bro, Puffin, or Silk) and click <strong className="text-[#00DF81]">Open in VLC</strong> to play immediately.
                    </span>
                  </li>
                </ol>
              ) : guideTab === 'desktop' ? (
                <ol className="space-y-2 text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Copy the <strong className="text-slate-900 dark:text-white">Direct Network Stream URL</strong> above or click <em>Copy Link</em>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Open <strong className="text-slate-900 dark:text-white">VLC Media Player</strong> on your PC or Mac.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[10px]">Ctrl + N</kbd> (Windows/Linux) or <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[10px]">Cmd + N</kbd> (macOS), or click <strong>Media &gt; Open Network Stream</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      Paste the URL into the network field and click <strong className="text-[#00DF81]">Play</strong>. The video will stream immediately with full audio and subtitle support!
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-2 text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Click <strong className="text-slate-900 dark:text-white">Copy Link</strong> above to copy the direct streaming link.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Open the <strong className="text-slate-900 dark:text-white">VLC App</strong> on Android or iOS / iPadOS.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Go to the <strong className="text-slate-900 dark:text-white">Streams</strong> or <strong className="text-slate-900 dark:text-white">Network Stream</strong> tab (or tap <em>More &gt; Streams</em>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      Tap the <strong className="text-slate-900 dark:text-white">+</strong> (Add Stream) button, paste the copied link, and tap <strong className="text-[#00DF81]">Play Stream</strong>!
                    </span>
                  </li>
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#111927] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:bg-[#182335] dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#182335] dark:hover:bg-slate-700 dark:text-slate-200 dark:border-[#1E293B] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Link' : 'Copy URL'}</span>
            </button>

            {targetDevice === 'android-tv' ? (
              <button
                onClick={handleStreamToAndroidTv}
                disabled={tvStreaming}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 dark:shadow-orange-950/30 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{tvStreaming ? 'Launching...' : 'Play on Android TV'}</span>
              </button>
            ) : (
              <button
                onClick={handleLaunch}
                disabled={launched}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 dark:shadow-orange-950/30 transition-all active:scale-[0.98]"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{launched ? 'Opening VLC...' : 'Launch VLC'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
