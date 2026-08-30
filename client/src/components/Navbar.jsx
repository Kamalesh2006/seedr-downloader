import React from 'react';
import { 
  Sun, 
  Moon,
  Bell, 
  Settings
} from 'lucide-react';

export default function Navbar({ 
  currentTab = 'dashboard', 
  setCurrentTab,
  isDarkMode = true,
  onToggleTheme
}) {
  return (
    <header className="h-16 bg-[#070B14]/90 backdrop-blur-md border-b border-[#1E293B] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Brand Logo */}
      <div 
        onClick={() => setCurrentTab('dashboard')} 
        className="flex items-center gap-2.5 cursor-pointer group"
      >
        {/* Seedr Cloud Logo SVG */}
        <div className="relative flex items-center justify-center text-[#00DF81] transition-transform group-hover:scale-105">
          <svg 
            className="w-7 h-7 stroke-current fill-none stroke-[2.2]" 
            viewBox="0 0 24 24" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <path d="M12 11v6" />
            <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
          </svg>
        </div>
        <span className="text-2xl font-extrabold tracking-tight text-[#00DF81] font-sans">
          Seedr
        </span>
      </div>

      {/* Right: Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Toggle (Moon Icon matching mockup) */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? (
            <Moon className="w-5 h-5 stroke-[1.75]" />
          ) : (
            <Sun className="w-5 h-5 stroke-[1.75]" />
          )}
        </button>

        {/* Desktop Quick Notifications & Settings */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => {}}
            className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
            title="System Status"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00DF81] animate-pulse" />
          </button>

          <button
            onClick={() => {}}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
