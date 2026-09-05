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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D1424]/95 backdrop-blur-xl border-t border-[#1E293B] px-4 py-2 safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
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
                className="flex flex-col items-center justify-center transition-all relative py-1 px-3 rounded-2xl text-slate-400 hover:text-sky-400 active:scale-95"
                title="Open Telegram Bot"
              >
                <div className="relative">
                  <Icon className="w-5 h-5 text-slate-400 group-hover:text-sky-400 stroke-[1.75]" />
                  {tab.badge && (
                    <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#00DF81] text-[#071911]">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight font-medium">
                  {tab.label}
                </span>
              </a>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={`flex flex-col items-center justify-center transition-all relative py-1 px-3 rounded-2xl ${
                isActive
                  ? 'bg-[#00DF81] text-[#071911] font-bold shadow-md shadow-emerald-500/25 px-5 py-2 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#071911] stroke-[2.5]' : 'text-slate-400 stroke-[1.75]'}`} />
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#00DF81] text-[#071911]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'font-black text-[#071911]' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
