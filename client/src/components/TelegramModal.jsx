import React, { useState, useEffect } from 'react';
import { Send, Bot, CheckCircle2, Copy, Check, ExternalLink, X, Terminal, Shield, FolderGit2, Search, ArrowRight } from 'lucide-react';
import api from '../api/client';

export default function TelegramModal({ isOpen, onClose }) {
  const [botStatus, setBotStatus] = useState({ enabled: false, botUsername: null, botName: 'Seedr Bot' });
  const [copiedCmd, setCopiedCmd] = useState(null);

  useEffect(() => {
    if (isOpen) {
      api.get('/telegram/status')
        .then(res => setBotStatus(res.data))
        .catch(() => setBotStatus({ enabled: false, botUsername: null, botName: 'Seedr Bot' }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const botUrl = botStatus.botUsername ? `https://t.me/${botStatus.botUsername}` : null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800/90 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/80 bg-gradient-to-r from-gray-900 via-gray-900 to-sky-950/40">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-sky-500 to-blue-600 p-2.5 rounded-2xl shadow-lg shadow-sky-500/20 text-white">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-100">Telegram Bot Integration</h3>
                {botStatus.enabled ? (
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Control Seedr directly from your phone or desktop via Telegram</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quick Launch Banner */}
          <div className="bg-gradient-to-br from-sky-950/40 via-gray-800/50 to-blue-950/30 border border-sky-800/40 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div>
                <h4 className="font-semibold text-white text-base flex items-center gap-2">
                  <Bot className="w-5 h-5 text-sky-400" />
                  {botStatus.botUsername ? `@${botStatus.botUsername}` : 'Seedr Cloud Telegram Bot'}
                </h4>
                <p className="text-xs text-gray-300 mt-1 max-w-md">
                  Search torrents, auto-add magnets from mobile, browse your Seedr cloud files, and get high-speed direct download links anytime.
                </p>
              </div>

              {botUrl ? (
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-sky-500/25 flex items-center gap-2 transition-all transform active:scale-95 shrink-0"
                >
                  <span>Open in Telegram</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <div className="text-xs font-mono text-sky-300 bg-sky-950/80 px-3 py-2 rounded-lg border border-sky-700/50">
                  Add TELEGRAM_BOT_TOKEN to .env
                </div>
              )}
            </div>
          </div>

          {/* Features Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-800/40 border border-gray-800 p-3.5 rounded-xl flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-sm font-semibold text-gray-200">Instant Torrent Search</h5>
                <p className="text-xs text-gray-400 mt-0.5">Type <code>/search movie</code> or any keyword to get torrents with 1-click cloud addition.</p>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-800 p-3.5 rounded-xl flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-sm font-semibold text-gray-200">Cloud File Manager</h5>
                <p className="text-xs text-gray-400 mt-0.5">Use <code>/files</code> to navigate folders, get direct download URLs, and delete files.</p>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-800 p-3.5 rounded-xl flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-sm font-semibold text-gray-200">Auto Magnet Ingestion</h5>
                <p className="text-xs text-gray-400 mt-0.5">Simply paste any <code>magnet:?xt=...</code> link in Telegram chat to start cloud caching.</p>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-800 p-3.5 rounded-xl flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-sm font-semibold text-gray-200">Access Control</h5>
                <p className="text-xs text-gray-400 mt-0.5">Restrict bot commands to your specific Telegram ID for complete privacy.</p>
              </div>
            </div>
          </div>

          {/* Commands Reference */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Available Commands</h4>
            <div className="space-y-2">
              {[
                { cmd: '/search <name>', desc: 'Search torrents across 1337x, PirateBay, YTS with 1-click add' },
                { cmd: '/files', desc: 'Browse Seedr cloud folders, get download links & delete files' },
                { cmd: '/transfers', desc: 'Check real-time progress of active Seedr torrent downloads' },
                { cmd: '/quota', desc: 'Display used vs available Seedr cloud storage space' },
                { cmd: '/help', desc: 'Show interactive quick-action menu and command guide' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-800/30 rounded-xl border border-gray-800 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="bg-gray-900 px-2 py-1 rounded font-mono text-sky-300 font-semibold">{item.cmd}</code>
                    <span className="text-gray-400 truncate">{item.desc}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.cmd.split(' ')[0], idx)}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Copy command"
                  >
                    {copiedCmd === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Setup / Configuration guide */}
          <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-gray-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              Bot Setup in server/.env
            </h4>
            <p className="text-xs text-gray-400">
              1. Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline font-medium">@BotFather</a>.<br />
              2. Send <code>/newbot</code> to create your bot and copy the API token.<br />
              3. Add to <code>server/.env</code>:
            </p>
            <div className="bg-gray-900 p-3 rounded-xl border border-gray-800 font-mono text-[11px] text-gray-300 relative group">
              <div>TELEGRAM_BOT_TOKEN=your_token_from_botfather</div>
              <div>TELEGRAM_BOT_USERNAME=your_bot_username</div>
              <div className="text-gray-500 mt-1"># Optional: restrict access to your Telegram user ID or username</div>
              <div>TELEGRAM_ALLOWED_USERS=your_telegram_username</div>

              <button
                onClick={() => copyToClipboard('TELEGRAM_BOT_TOKEN=your_token\nTELEGRAM_BOT_USERNAME=your_bot\nTELEGRAM_ALLOWED_USERS=your_username', 'env')}
                className="absolute top-2.5 right-2.5 p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                title="Copy config"
              >
                {copiedCmd === 'env' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800/80 bg-gray-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
