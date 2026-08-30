import React from 'react';
import { 
  Sun, 
  Bell, 
  Settings, 
  User, 
  Send, 
  CloudRain, 
  Menu, 
  X,
  ListOrdered,
  Clock,
  Sparkles
} from 'lucide-react';

export default function Navbar({ 
  currentTab = 'dashboard', 
  setCurrentTab,
  onOpenRecent,
  onOpenTelegram,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  queueCount = 0
}) {
  return (
    <header className="h-16 bg-[#070D18] border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Brand Logo & Mobile Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-800"
          title="Toggle Menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div 
          onClick={() => setCurrentTab('dashboard')} 
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <span className="text-2xl font-black tracking-tight text-emerald-400 font-sans hover:opacity-90 transition-opacity">
            Seedr
          </span>
        </div>
      </div>

      {/* Center: Main Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-8 h-full">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`h-full flex items-center gap-2 text-sm font-semibold border-b-2 transition-all px-1 ${
            currentTab === 'dashboard'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setCurrentTab('queue')}
          className={`h-full flex items-center gap-2 text-sm font-semibold border-b-2 transition-all px-1 ${
            currentTab === 'queue'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Upcoming Queue</span>
          {queueCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {queueCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenRecent}
          className="h-full flex items-center gap-1.5 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition-colors px-1"
        >
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>Magnets</span>
        </button>

        <button
          onClick={onOpenTelegram}
          className="h-full flex items-center gap-1.5 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-sky-300 transition-colors px-1"
        >
          <Send className="w-4 h-4 text-sky-400" />
          <span>Telegram Bot</span>
        </button>
      </nav>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => {}}
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-slate-800/60 rounded-xl transition-colors"
          title="Toggle Theme"
        >
          <Sun className="w-4 h-4" />
        </button>

        <button
          onClick={() => {}}
          className="relative p-2 text-gray-400 hover:text-gray-200 hover:bg-slate-800/60 rounded-xl transition-colors"
          title="Watchdog & System Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        <button
          onClick={() => {}}
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-slate-800/60 rounded-xl transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-emerald-300">
              K
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
