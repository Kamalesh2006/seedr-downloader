import React from 'react';
import { 
  Folder, 
  Clock, 
  Trash2, 
  HardDrive, 
  Send, 
  ListOrdered, 
  HelpCircle, 
  LogOut, 
  Cloud,
  Radio
} from 'lucide-react';
import { formatBytes } from '../utils/magnet';

export default function Sidebar({ 
  currentTab = 'dashboard', 
  setCurrentTab, 
  storage = { spaceUsed: 0, spaceMax: 0 },
  queueCount = 0,
  recentCount = 0,
  telegramUrl = 'https://t.me/seedr_download_bot',
  onOpenRecent
}) {
  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024);

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'All Files', 
      icon: Folder, 
      badge: null 
    },
    { 
      id: 'acestream', 
      label: 'Ace Stream', 
      icon: Radio, 
      badge: 'Live',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    { 
      id: 'queue', 
      label: 'Upcoming Queue', 
      icon: ListOrdered, 
      badge: queueCount > 0 ? queueCount : null,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    { 
      id: 'recent', 
      label: 'Recent Links', 
      icon: Clock, 
      badge: recentCount > 0 ? recentCount : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    { 
      id: 'telegram', 
      label: 'Telegram Bot', 
      icon: Send, 
      badge: 'Active',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    },
    { 
      id: 'storage', 
      label: 'Storage Details', 
      icon: HardDrive, 
      badge: null 
    }
  ];

  return (
    <aside className="w-64 bg-[#070D18] border-r border-slate-800/80 flex flex-col justify-between shrink-0 min-h-screen select-none">
      {/* Top Section */}
      <div>
        {/* Storage Account Header Card */}
        <div className="p-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 text-gray-950 rounded-xl shadow-lg shadow-emerald-500/20 font-bold flex items-center justify-center">
              <Cloud className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-gray-100 truncate">Cloud Storage</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                Managing {formatBytes(used, 1)} of {formatBytes(max, 1)}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3.5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            if (item.id === 'telegram') {
              return (
                <a
                  key={item.id}
                  href={telegramUrl || "https://t.me/seedr_download_bot"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all text-gray-400 hover:text-sky-300 hover:bg-slate-800/50 border border-transparent"
                  title="Open Seedr Telegram Bot"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-sky-400" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#00DF81]/15 text-[#00DF81] font-bold border border-[#00DF81]/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-800/60 space-y-1">
        <a
          href="https://www.seedr.cc/faq"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-800/40 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help & FAQ</span>
        </a>
        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-800/40 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sync Account</span>
        </button>
      </div>
    </aside>
  );
}
