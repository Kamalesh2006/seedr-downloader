import React from 'react';
import { 
  Sun, 
  Moon,
  Settings,
  Send,
  Bot
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar({ 
  isDarkMode = true,
  onToggleTheme
}) {
  return (
    <header className="h-14 sm:h-16 bg-[#070B14]/90 backdrop-blur-md border-b border-[#1E293B] px-3.5 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Brand Logo */}
      <Link 
        to="/" 
        className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group"
      >
        {/* Seedr Cloud Logo SVG */}
        <div className="relative flex items-center justify-center text-[#00DF81] transition-transform group-hover:scale-105">
          <svg 
            className="w-6 h-6 sm:w-7 sm:h-7 stroke-current fill-none stroke-[2.2]" 
            viewBox="0 0 24 24" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <path d="M12 11v6" />
            <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
          </svg>
        </div>
        <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#00DF81] font-sans">
          Seedr
        </span>
      </Link>

      {/* Right: Action Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Telegram Bot Link */}
        <Link
          to="/bot"
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            isDarkMode 
              ? 'text-slate-400 hover:text-sky-400 hover:bg-slate-800/60' 
              : 'text-slate-500 hover:text-sky-600 hover:bg-slate-100'
          }`}
          title="Open Telegram Bot"
          aria-label="Telegram Bot"
        >
          <Bot className="w-5 h-5 sm:w-4 sm:h-4 stroke-[1.75]" />
        </Link>

        {/* Theme Toggle (Moon / Sun Icon) */}
        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            isDarkMode 
              ? 'text-slate-300 hover:text-white hover:bg-slate-800/60' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <Moon className="w-5 h-5 stroke-[1.75] text-slate-300 hover:text-amber-300 transition-colors" />
          ) : (
            <Sun className="w-5 h-5 stroke-[1.75] text-amber-500 hover:text-amber-600 transition-colors" />
          )}
        </button>

        {/* Settings Button - Navigates to /settings */}
        <Link
          to="/settings"
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            isDarkMode 
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="Settings & Storage Details"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 sm:w-4 sm:h-4 stroke-[1.75]" />
        </Link>
      </div>
    </header>
  );
}
