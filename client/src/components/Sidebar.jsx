import React from 'react';
import { 
  Folder, 
  Send, 
  ListOrdered, 
  HelpCircle, 
  Cloud, 
  History, 
  Settings, 
  Search,
  Tv 
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { formatBytes } from '../utils/magnet';

export default function Sidebar({ 
  storage = { spaceUsed: 0, spaceMax: 0 },
  queueCount = 0,
  recentCount = 0,
  onOpenSettings
}) {
  const location = useLocation();
  const currentPath = location.pathname;

  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024);

  const navItems = [
    { 
      id: 'dashboard', 
      path: '/',
      label: 'All Files', 
      icon: Folder, 
      badge: null 
    },
    { 
      id: 'search', 
      path: '/search',
      label: 'Search Torrents', 
      icon: Search, 
      badge: null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    { 
      id: 'queue', 
      path: '/upcoming',
      label: 'Upcoming Queue', 
      icon: ListOrdered, 
      badge: queueCount > 0 ? queueCount : null,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    { 
      id: 'recent', 
      path: '/recent',
      label: 'Recent Links', 
      icon: History, 
      badge: recentCount > 0 ? recentCount : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    { 
      id: 'telegram', 
      path: '/bot',
      label: 'Telegram Bot', 
      icon: Send, 
      badge: 'Active',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    },
    { 
      id: 'tv', 
      path: '/tv',
      label: 'Android TV', 
      icon: Tv, 
      badge: 'VLC',
      badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    }
  ];

  return (
    <aside className="w-64 bg-[#070D18] border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-full overflow-y-auto select-none">
      {/* Top Section */}
      <div>
        {/* Storage Account Header Card - Navigates to Settings */}
        <Link 
          to="/settings"
          className="block p-5 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group cursor-pointer"
          title="View storage details in Settings"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 text-gray-950 rounded-xl shadow-lg shadow-emerald-500/20 font-bold flex items-center justify-center transition-transform group-hover:scale-105">
              <Cloud className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-gray-100 truncate group-hover:text-[#00DF81] transition-colors">
                Cloud Storage
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                Managing {formatBytes(used, 1)} of {formatBytes(max, 1)}
              </p>
            </div>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="p-3.5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path || 
              (item.path === '/' && (currentPath === '/home' || currentPath === '')) ||
              (item.path === '/upcoming' && currentPath === '/queue') ||
              (item.path === '/bot' && currentPath === '/telegram');

            return (
              <Link
                key={item.id}
                to={item.path}
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
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-800/60 space-y-1">
        <Link
          to="/settings"
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors ${
            currentPath === '/settings'
              ? 'bg-[#00DF81]/15 text-[#00DF81] font-bold border border-[#00DF81]/30 shadow-sm'
              : 'text-gray-400 hover:text-emerald-400 hover:bg-slate-800/40'
          }`}
          title="Open Settings & Storage Details"
        >
          <Settings className="w-4 h-4 text-emerald-400" />
          <span>Settings</span>
        </Link>
        <a
          href="https://www.seedr.cc/faq"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-800/40 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help & FAQ</span>
        </a>
      </div>
    </aside>
  );
}
