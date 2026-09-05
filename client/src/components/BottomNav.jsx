import React from 'react';
import { Folder, History, Database, Bot, Film } from 'lucide-react';

export default function BottomNav({ 
  currentTab, 
  setCurrentTab, 
  telegramUrl = 'https://t.me/seedr_download_bot',
  recentCount = 0
}) {
  const tabs = [
    {
      id: 'dashboard',
      label: 'All Files',
      icon: Folder,
      onClick: () => setCurrentTab('dashboard')
    },
    {
      id: 'discover',
      label: 'Top Releases',
      icon: Film,
      badge: 'Hot',
      onClick: () => setCurrentTab('discover')
    },
    {
      id: 'recent',
      label: 'Recent',
      icon: History,
      badge: recentCount > 0 ? recentCount : null,
      onClick: () => setCurrentTab('recent')
    },
    {
      id: 'storage',
      label: 'Storage',
      icon: Database,
      onClick: () => setCurrentTab('storage')
    },
    {
      id: 'bot',
      label: 'Bot',
      icon: Bot,
      href: telegramUrl || 'https://t.me/seedr_download_bot'
    }
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden mobile-bottom-nav bg-[#0D1424]/95 backdrop-blur-xl border-t border-[#1E293B] px-1 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] select-none"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          if (tab.href) {
            return (
              <a
                key={tab.id}
                href={tab.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-400 hover:text-sky-400 active:scale-95 transition-all group"
                title="Open Telegram Bot"
              >
                <div className="relative flex items-center justify-center">
                  <div className="px-3 py-1 rounded-full group-hover:bg-sky-500/10 transition-colors">
                    <Icon className="w-5 h-5 text-slate-400 group-hover:text-sky-400 stroke-[1.75]" />
                  </div>
                  {tab.badge && (
                    <span className="absolute -top-1 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#00DF81] text-[#071911] shadow-sm">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight font-medium text-slate-400 group-hover:text-sky-400 truncate max-w-full">
                  {tab.label}
                </span>
              </a>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
                isActive
                  ? 'text-[#00DF81] dark:text-[#00DF81]'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <div className={`px-3 py-1 rounded-full transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#00DF81]/20 text-[#00DF81] dark:bg-[#00DF81]/25 dark:text-[#00DF81] shadow-sm shadow-emerald-500/20 scale-105' 
                    : 'hover:bg-slate-800/40 text-slate-400'
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2] text-[#00DF81]' : 'stroke-[1.75]'}`} />
                </div>
                {tab.badge && !isActive && (
                  <span className={`absolute -top-1 right-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold shadow-sm ${
                    tab.badge === 'Hot' 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-[#00DF81] text-[#071911]'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full ${
                isActive 
                  ? 'font-bold text-[#00DF81]' 
                  : 'font-medium text-slate-400'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
