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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#111927]">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500/10 text-sky-400 p-2.5 rounded-xl border border-sky-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Telegram Bot</h3>
                {botStatus.enabled ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#00DF81]/10 text-[#00DF81] border border-[#00DF81]/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81] animate-pulse"></span>
                    Online
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Control Seedr directly from your phone via Telegram</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Quick Launch Banner */}
          <div className="bg-[#090F1C] border border-[#1E293B] rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div>
                <h4 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-400" />
                  {botStatus.botUsername ? `@${botStatus.botUsername}` : 'Seedr Cloud Telegram Bot'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Search torrents, auto-download magnet links from mobile, browse cloud files, and stream anytime.
                </p>
              </div>

              {botUrl ? (
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-sky-500/25 flex items-center gap-2 transition-all transform active:scale-95 shrink-0"
                >
                  <span>Open in Telegram</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <div className="text-xs font-mono text-sky-300 bg-sky-950/80 px-3 py-2 rounded-lg border border-sky-700/50">
                  Add TELEGRAM_BOT_TOKEN
                </div>
              )}
            </div>
          </div>

          {/* Features Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-[#090F1C] border border-[#1E293B] p-3 rounded-xl flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#00DF81]/10 text-[#00DF81] shrink-0 mt-0.5">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs sm:text-sm font-semibold text-slate-200">Instant Search</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">Type <code>/search movie</code> for 1-click cloud addition.</p>
              </div>
            </div>

            <div className="bg-[#090F1C] border border-[#1E293B] p-3 rounded-xl flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs sm:text-sm font-semibold text-slate-200">Cloud File Manager</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">Use <code>/files</code> to get direct links or stream.</p>
              </div>
            </div>
          </div>

          {/* Commands Reference */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Available Commands</h4>
            <div className="space-y-1.5">
              {[
                { cmd: '/search <keyword>', desc: 'Search torrents with 1-click add' },
                { cmd: '/files', desc: 'Browse Seedr cloud folders & download links' },
                { cmd: '/transfers', desc: 'Check real-time download progress' },
                { cmd: '/quota', desc: 'Display used vs available storage' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#090F1C] rounded-xl border border-[#1E293B] text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="bg-[#141D2E] px-2 py-0.5 rounded font-mono text-sky-300 font-semibold">{item.cmd}</code>
                    <span className="text-slate-400 truncate text-[11px]">{item.desc}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.cmd.split(' ')[0], idx)}
                    className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                    title="Copy"
                  >
                    {copiedCmd === idx ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#1E293B] bg-[#111927] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
