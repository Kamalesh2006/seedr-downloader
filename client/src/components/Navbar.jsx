import React, { useState, useRef, useEffect } from 'react';
import { 
  Sun, 
  Moon,
  Settings,
  Bot,
  User,
  LogIn,
  LogOut,
  ChevronDown,
  UserCheck,
  Shield,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/magnet';

export default function Navbar({ 
  isDarkMode = true,
  onToggleTheme,
  onOpenAuth
}) {
  const { isGuest, hasUserSession, user, logout, switchToGuest, switchToUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 sm:h-16 bg-[#070B14]/90 backdrop-blur-md border-b border-[#1E293B] px-3 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
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

      {/* Right: Action Controls & User Account Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        
        {/* User / Guest Account Pill */}
        <div className="relative" ref={dropdownRef}>
          {isGuest ? (
            <div className="flex items-center gap-1">
              {hasUserSession ? (
                // Guest mode active, but user has signed in previously
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 text-xs font-semibold transition-all active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="hidden sm:inline">Guest View</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              ) : (
                // No personal session: show Guest pill with Sign In button
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1E293B] bg-slate-100/80 dark:bg-slate-800/60 hover:border-[#00DF81]/50 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 group"
                >
                  <User className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00DF81] transition-colors" />
                  <span>Guest</span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-[#00DF81]/15 text-[#00DF81] text-[10px] font-bold ml-1">
                    Log In
                  </span>
                </button>
              )}
            </div>
          ) : (
            // User Mode Active: show personal account pill
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#00DF81]/30 bg-[#00DF81]/10 hover:bg-[#00DF81]/15 text-slate-900 dark:text-white text-xs font-semibold transition-all active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-[#00DF81]" />
              <span className="max-w-[100px] sm:max-w-[140px] truncate text-slate-900 dark:text-white font-bold">
                {user?.username || user?.email || 'My Account'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          {/* Account Menu Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Account Summary */}
              <div className="p-3 bg-slate-50 dark:bg-[#090F1C] rounded-xl border border-slate-100 dark:border-[#1E293B] mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {isGuest ? 'Current: Guest Mode' : 'Connected Seedr'}
                  </span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                    user?.premium 
                      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20' 
                      : 'bg-[#00DF81]/15 text-[#00DF81]'
                  }`}>
                    {user?.packageName || (user?.premium ? 'Premium' : 'Free 2GB+')}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {isGuest ? 'Shared Server Storage (4.5 GB)' : (user?.email || 'Personal Seedr Cloud')}
                </p>
                {!isGuest && user?.spaceMax > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Storage: {formatBytes(user.spaceUsed || 0)} / {formatBytes(user.spaceMax || 0)}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-1">
                {isGuest ? (
                  <>
                    {hasUserSession && (
                      <button
                        onClick={() => {
                          switchToUser();
                          setDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-[#00DF81]" />
                        <span>Switch to My Account</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenAuth();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#00DF81] hover:bg-[#00DF81]/10 rounded-xl transition-colors text-left"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Connect Personal Seedr</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        switchToGuest();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />
                      <span>Switch to Guest View</span>
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

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

        {/* Theme Toggle (Sun / Moon Icon) */}
        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            isDarkMode 
              ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-800/60' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
          aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 stroke-[1.75] text-amber-400 hover:text-amber-300 transition-colors" />
          ) : (
            <Moon className="w-5 h-5 stroke-[1.75] text-slate-600 hover:text-indigo-600 transition-colors" />
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
