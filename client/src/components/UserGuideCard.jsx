import React from 'react';
import { 
  CloudDownload, 
  Search, 
  Play, 
  ArrowRight, 
  Sparkles, 
  HardDrive,
  Magnet
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UserGuideCard() {
  return (
    <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 lg:p-7 shadow-sm dark:shadow-lg dark:shadow-black/20 space-y-5 mt-2 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#00DF81] border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              How Seedr Works
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Convert torrents into direct high-speed downloads in 3 simple steps
            </p>
          </div>
        </div>

        <Link
          to="/search"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#00DF81] hover:bg-[#05D686] text-[#071911] text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 self-start sm:self-auto shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search Torrents</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 3 Simple Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1 */}
        <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200/80 dark:border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-2.5 flex flex-col justify-start">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-[#00DF81] text-[#071911] font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
              1
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Search
            </h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Find movies, shows, or torrents in the <Link to="/search" className="text-emerald-600 dark:text-[#00DF81] font-semibold hover:underline">Search</Link> tab.
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200/80 dark:border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-2.5 flex flex-col justify-start">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-[#00DF81] text-[#071911] font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
              2
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Add to Cloud
            </h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Click <strong className="text-slate-700 dark:text-slate-200">Add to Cloud</strong>. Seedr downloads it to your storage instantly.
          </p>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200/80 dark:border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-2.5 flex flex-col justify-start">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-[#00DF81] text-[#071911] font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
              3
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Download or Stream
            </h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Download at full ISP speed or stream video files directly in your browser.
          </p>
        </div>
      </div>

      {/* Concise Tips Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Free accounts support up to <strong className="text-slate-700 dark:text-slate-200">4.5 GB</strong> per file.</span>
        </div>
        <div className="flex items-center gap-2">
          <Magnet className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Have a custom magnet link? Paste it in <Link to="/upcoming" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Upcoming Queue</Link>.</span>
        </div>
      </div>
    </div>
  );
}
