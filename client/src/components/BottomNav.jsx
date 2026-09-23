import React from 'react';
import { Folder, History, Settings, Search, ListOrdered } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function BottomNav({ 
  recentCount = 0,
  queueCount = 0
}) {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    {
      id: 'dashboard',
      path: '/',
      label: 'Files',
      icon: Folder,
    },
    {
      id: 'search',
      path: '/search',
      label: 'Search',
      icon: Search,
      badge: null,
    },
    {
      id: 'queue',
      path: '/upcoming',
      label: 'Queue',
      icon: ListOrdered,
      badge: queueCount > 0 ? queueCount : null,
    },
    {
      id: 'recent',
      path: '/recent',
      label: 'Recent',
      icon: History,
      badge: recentCount > 0 ? recentCount : null,
    },
    {
      id: 'settings',
      path: '/settings',
      label: 'Settings',
      icon: Settings,
      badge: null,
    }
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-[#0D1424]/95 backdrop-blur-xl border-t border-[#1E293B] px-1 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] select-none"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentPath === tab.path || 
            (tab.path === '/' && (currentPath === '/home' || currentPath === '')) ||
            (tab.path === '/upcoming' && currentPath === '/queue');

          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
                isActive
                  ? 'text-emerald-600 dark:text-[#00DF81]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 active:scale-95'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <div className={`px-3 py-1 rounded-full transition-all duration-200 ${
                  isActive 
                    ? 'bg-emerald-500/15 dark:bg-[#00DF81]/25 text-emerald-600 dark:text-[#00DF81] shadow-sm shadow-emerald-500/20 scale-105' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2] text-emerald-600 dark:text-[#00DF81]' : 'stroke-[1.75]'}`} />
                </div>
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 right-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold shadow-sm bg-[#00DF81] text-[#071911]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full ${
                isActive 
                  ? 'font-bold text-emerald-600 dark:text-[#00DF81]' 
                  : 'font-medium text-slate-600 dark:text-slate-400'
              }`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
