import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Monitor, 
  Smartphone, 
  HelpCircle, 
  Tv, 
  Flame,
  Radio,
  FileCode2,
  ChevronRight
} from 'lucide-react';
import { openInVLC, downloadM3UPlaylist, copyVLCStreamUrl, getDeviceInfo } from '../utils/vlc';

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
  const [guideTab, setGuideTab] = useState('desktop');
  const [launched, setLaunched] = useState(false);

  if (!isOpen || !file) return null;

  const device = getDeviceInfo();
  const fileName = file.name || 'Media Stream';
  const urlToUse = streamUrl || file.hlsUrl || '';

  const handleCopy = async () => {
    if (!urlToUse) return;
    const success = await copyVLCStreamUrl(urlToUse);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleLaunch = () => {
    if (!urlToUse) return;
    openInVLC(urlToUse, fileName);
    setLaunched(true);
    setTimeout(() => setLaunched(false), 4000);
  };

  const handleDownloadM3U = () => {
    if (!urlToUse) return;
    downloadM3UPlaylist(urlToUse, fileName);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#111927] border border-[#1E293B] w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with VLC Theme */}
        <div className="px-5 py-4 border-b border-[#1E293B] bg-gradient-to-r from-[#172338] via-[#111927] to-[#1e1915] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-2xl border border-orange-500/20 shadow-inner shrink-0">
              <VlcIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Stream in VLC Media Player
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                  {device.osName}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {fileName}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 bg-[#0A101D]">
          
          {/* Main Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Action 1: Launch VLC App */}
            <div className="p-4 rounded-2xl bg-[#131D2F] border border-[#1E293B] hover:border-orange-500/40 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    <Play className="w-4 h-4 fill-current" />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {device.isMobile ? 'Mobile App' : 'Protocol Launch'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-orange-400 transition-colors">
                  1. Launch VLC App
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {device.isMobile 
                    ? `Directly opens the stream inside your ${device.osName} VLC application.` 
                    : 'Launches desktop VLC directly via vlc:// protocol handler.'}
                </p>
              </div>

              <button
                onClick={handleLaunch}
                className="mt-4 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{launched ? 'Opening VLC...' : 'Open in VLC App'}</span>
              </button>
            </div>

            {/* Action 2: Download .m3u Playlist */}
            <div className="p-4 rounded-2xl bg-[#131D2F] border border-[#1E293B] hover:border-emerald-500/40 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-2 rounded-xl bg-[#00DF81]/10 text-[#00DF81] border border-[#00DF81]/20">
                    <FileCode2 className="w-4 h-4" />
                  </span>
                  <span className="text-[11px] font-bold text-[#00DF81]">
                    Recommended for PC/Mac
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-[#00DF81] transition-colors">
                  2. Download .m3u Playlist
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  1-click instant stream file. Double-clicking it opens VLC on desktop without downloading the video.
                </p>
              </div>

              <button
                onClick={handleDownloadM3U}
                className="mt-4 w-full py-2.5 px-3 rounded-xl bg-[#18263B] hover:bg-[#1E304B] border border-[#233550] text-[#00DF81] hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .m3u Stream File</span>
              </button>
            </div>
          </div>

          {/* Stream Link Box */}
          <div className="p-4 rounded-2xl bg-[#0E1624] border border-[#1E293B]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Radio className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                <span>Direct Network Stream URL</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Ready for VLC Network Stream</span>
            </div>

            <div className="flex items-center gap-2 bg-[#080D17] p-1.5 pl-3 rounded-xl border border-[#182335]">
              <input
                type="text"
                readOnly
                value={urlToUse}
                className="bg-transparent text-xs text-slate-300 w-full focus:outline-none font-mono truncate select-all"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
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
          <div className="rounded-2xl bg-[#0E1624] border border-[#1E293B] overflow-hidden">
            <div className="px-4 py-3 bg-[#141D2D] border-b border-[#1E293B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-orange-400" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                  How to stream in VLC (Network Stream Option)
                </h4>
              </div>

              {/* Device Tabs */}
              <div className="flex items-center p-0.5 bg-[#0B111D] rounded-lg border border-[#1E293B]">
                <button
                  onClick={() => setGuideTab('desktop')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    guideTab === 'desktop' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3 h-3" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setGuideTab('mobile')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    guideTab === 'mobile' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Mobile App</span>
                </button>
              </div>
            </div>

            <div className="p-4 text-xs space-y-3">
              {guideTab === 'desktop' ? (
                <ol className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Copy the <strong className="text-white">Direct Network Stream URL</strong> above or click <em>Copy Link</em>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Open <strong className="text-white">VLC Media Player</strong> on your PC or Mac.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">Ctrl + N</kbd> (Windows/Linux) or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">Cmd + N</kbd> (macOS), or click <strong>Media &gt; Open Network Stream</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      Paste the URL into the network field and click <strong className="text-[#00DF81]">Play</strong>. The video will stream immediately with full audio and subtitle support!
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Click <strong className="text-white">Copy Link</strong> above to copy the direct streaming link.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Open the <strong className="text-white">VLC App</strong> on Android or iOS / iPadOS.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Go to the <strong className="text-white">Streams</strong> or <strong className="text-white">Network Stream</strong> tab (or tap <em>More &gt; Streams</em>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      Tap the <strong className="text-white">+</strong> (Add Stream) button, paste the copied link, and tap <strong className="text-[#00DF81]">Play Stream</strong>!
                    </span>
                  </li>
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#1E293B] bg-[#111927] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#182335] hover:bg-slate-800 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#182335] hover:bg-slate-700 text-slate-200 border border-[#1E293B] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Link' : 'Copy URL'}</span>
            </button>
            <button
              onClick={handleLaunch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-950/30 transition-all active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch VLC</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
