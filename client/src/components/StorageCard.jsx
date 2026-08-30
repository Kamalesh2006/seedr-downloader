import React from 'react';
import { HardDrive, ArrowUpRight } from 'lucide-react';
import { formatBytes } from '../utils/magnet';

export default function StorageCard({ storage = { spaceUsed: 0, spaceMax: 0 }, onClickDetails }) {
  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024);
  const usedPercentage = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

  // Format used and max string e.g. "1.65 GB of 5 GB used"
  const formattedUsed = formatBytes(used, 2);
  const formattedMax = formatBytes(max, 0);

  return (
    <div 
      className={`bg-[#111927] border border-[#1E293B] rounded-2xl p-5 shadow-lg shadow-black/20 mb-6 transition-all ${
        onClickDetails ? 'cursor-pointer hover:border-slate-700/80 hover:bg-[#131D2E]' : ''
      }`}
      onClick={onClickDetails}
    >
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Storage</h3>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
            {formattedUsed} of {formattedMax} used
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm sm:text-base font-extrabold text-[#00DF81] tracking-tight">
            {usedPercentage}%
          </span>
          {onClickDetails && (
            <ArrowUpRight className="w-4 h-4 text-slate-500 hover:text-slate-300 transition-colors" />
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-[#0A101D] h-3 sm:h-3.5 rounded-full overflow-hidden border border-[#1E293B]/70 p-0.5">
        <div 
          className="h-full rounded-full bg-striped-mint transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${Math.min(100, Math.max(usedPercentage, used > 0 ? 3 : 0))}%` }}
        />
      </div>
    </div>
  );
}
