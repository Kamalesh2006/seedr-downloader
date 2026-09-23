import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  Search, 
  FolderGit2, 
  Zap, 
  Smartphone, 
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import api from '../api/client';

export default function TelegramBotView() {
  const [botStatus, setBotStatus] = useState({ enabled: false, botUsername: null, botName: 'Seedr Bot' });
  const [copiedCmd, setCopiedCmd] = useState(null);

  useEffect(() => {
    api.get('/telegram/status')
      .then(res => setBotStatus(res.data))
      .catch(() => setBotStatus({ enabled: false, botUsername: null, botName: 'Seedr Bot' }));
  }, []);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const botUrl = botStatus.botUsername ? `https://t.me/${botStatus.botUsername}` : 'https://t.me/seedr_download_bot';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 dark:border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-xl border border-sky-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Telegram Bot
              </h1>
              {botStatus.enabled ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#00DF81]/15 text-[#00DF81] border border-[#00DF81]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81] animate-pulse"></span>
                  Online
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                  Ready to Connect
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Control Seedr directly from your phone — search torrents, add magnets, and download straight to cloud
            </p>
          </div>
        </div>
      </div>

      {/* Main Bot Hero Card */}
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-[#111927] dark:to-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile-First Cloud Downloads</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {botStatus.botUsername ? `@${botStatus.botUsername}` : 'Seedr Cloud Telegram Bot'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              Connect your Telegram bot to convert magnet links directly on your phone. Even when you're away from your computer, Send a magnet link to your bot and it automatically downloads into your Seedr cloud.
            </p>
          </div>

          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-sky-500/25 transition-all active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Open in Telegram</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
          </a>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-white dark:bg-[#0A101D] border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1">
            <div className="p-2 rounded-lg bg-[#00DF81]/10 text-[#00DF81] w-fit mb-2">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Paste & Download</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Forward any magnet link into the chat to begin instant cloud conversion.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0A101D] border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500 dark:text-sky-400 w-fit mb-2">
              <Search className="w-4 h-4" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Inline Torrent Search</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Use <code>/search &lt;title&gt;</code> to browse torrent releases from mobile.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0A101D] border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 w-fit mb-2">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Cloud Storage Access</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Browse folders, generate high-speed direct download links, and check quota.
            </p>
          </div>
        </div>
      </div>

      {/* Available Commands Reference */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sky-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Available Bot Commands
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {[
            { cmd: '/search <movie name>', desc: 'Search torrent releases across indexers' },
            { cmd: '/files', desc: 'Browse Seedr cloud folders & high-speed links' },
            { cmd: '/transfers', desc: 'Check real-time active download status' },
            { cmd: '/quota', desc: 'Display used vs available cloud space' },
            { cmd: '/start', desc: 'Initialize and authenticate bot connection' },
            { cmd: '/help', desc: 'Display instructions and full command reference' }
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#090F1C] rounded-xl border border-slate-200 dark:border-[#1E293B] text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <code className="bg-slate-100 dark:bg-[#141D2E] px-2 py-1 rounded font-mono text-sky-600 dark:text-sky-300 font-semibold shrink-0">
                  {item.cmd}
                </code>
                <span className="text-slate-600 dark:text-slate-400 truncate text-[11px]">
                  {item.desc}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(item.cmd.split(' ')[0], idx)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                title="Copy command"
              >
                {copiedCmd === idx ? (
                  <Check className="w-4 h-4 text-[#00DF81]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
