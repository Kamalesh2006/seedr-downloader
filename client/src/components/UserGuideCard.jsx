import React from 'react';
import { 
  CloudDownload, 
  Search, 
  Play, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  HardDrive,
  ListOrdered
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UserGuideCard() {
  return (
    <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-lg dark:shadow-black/20 space-y-5 mt-3 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-[#00DF81] border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              New to Seedr? Quick Start Guide
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              How to convert torrents into high-speed direct downloads in 3 easy steps
            </p>
          </div>
        </div>

        <Link
          to="/search"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#00DF81] hover:bg-[#05D686] text-[#071911] text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-95 self-start sm:self-auto shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Start Searching Torrents</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 3 Step Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Step 1 */}
        <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200/90 dark:border-[#1E293B] rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#00DF81] text-[#071911] font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                1
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Find Torrents
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Head over to the <Link to="/search" className="font-semibold text-emerald-600 dark:text-[#00DF81] hover:underline">Search Torrents</Link> tab to browse trending movies, TV shows, and torrent releases across all major indexers.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#00DF81]" />
            <span>Millions of indexed releases</span>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200/90 dark:border-[#1E293B] rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#00DF81] text-[#071911] font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                2
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Click "Add to Cloud"
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Click the green <strong className="text-slate-800 dark:text-slate-200">Add to Cloud</strong> button on your chosen option. Seedr servers download the torrent silently to your cloud storage at ultra-high speeds.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
            <CloudDownload className="w-3.5 h-3.5 text-[#00DF81]" />
            <span>No torrent client or VPN needed</span>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200/90 dark:border-[#1E293B] rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#00DF81] text-[#071911] font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                3
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Download or Stream
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your completed files will appear right here in <strong className="text-slate-800 dark:text-slate-200">All Files</strong>. Download directly at your maximum ISP speed or stream video files instantly in your browser.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-[#00DF81]" />
            <span>Direct HTTP downloads & streaming</span>
          </div>
        </div>
      </div>

      {/* Helpful Quick Tips Footer */}
      <div className="bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
          <HardDrive className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            <strong className="text-slate-800 dark:text-slate-200">Cloud Storage Limit:</strong> Free accounts support up to 4.5 GB per file.
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <ListOrdered className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Have a custom magnet link? Paste it in the <Link to="/upcoming" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Upcoming Queue</Link>.
          </span>
        </div>
      </div>
    </div>
  );
}
