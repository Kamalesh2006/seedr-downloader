import React from 'react';
import { HardDrive, ArrowUpRight } from 'lucide-react';
import { formatBytes } from '../utils/magnet';

export default function StorageCard({ 
  storage = { spaceUsed: 0, spaceMax: 0 }, 
  onClickDetails,
  isGuest = true,
  user = null
}) {
  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024);
  const usedPercentage = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

  // Format used and max string e.g. "1.65 GB of 5 GB used"
  const formattedUsed = formatBytes(used, 2);
  const formattedMax = formatBytes(max, 0);

  const title = !isGuest && (user?.username || user?.email)
    ? `${user.username || user.email.split('@')[0]}'s Cloud`
    : 'Guest Storage';

  return (
    <div 
      className={`bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg dark:shadow-black/20 mb-5 sm:mb-6 transition-all ${
        onClickDetails ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700/80 hover:bg-slate-50/80 dark:hover:bg-[#131D2E] active:scale-[0.99]' : ''
      }`}
      onClick={onClickDetails}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
              !isGuest 
                ? 'bg-[#00DF81]/15 text-[#00DF81]' 
                : 'bg-amber-500/15 text-amber-500'
            }`}>
              {!isGuest ? (user?.packageName || 'Personal') : 'Shared Pool'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {formattedUsed} of {formattedMax} used
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm sm:text-base font-extrabold text-[#00DF81] tracking-tight">
            {usedPercentage}%
          </span>
          {onClickDetails && (
            <ArrowUpRight className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors" />
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-200 dark:bg-[#0A101D] h-2.5 sm:h-3 rounded-full overflow-hidden border border-slate-300/80 dark:border-[#1E293B]/70 p-0.5">
        <div 
          className="h-full rounded-full bg-striped-mint transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${Math.min(100, Math.max(usedPercentage, used > 0 ? 3 : 0))}%` }}
        />
      </div>
    </div>
  );
}
