import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationBar({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems = 0,
  pageSize = 18,
  isServerPaged = false,
  loading = false,
  itemLabel = 'releases'
}) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalItems > 0 ? Math.min(startItem + pageSize - 1, totalItems) : currentPage * pageSize;

  // Windowed page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis-left');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis-right');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-2 border-t border-slate-200 dark:border-[#1E293B] mt-5">
      {/* Items count summary */}
      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
        {totalItems > 0 && !isServerPaged ? (
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-mono">{startItem}–{endItem}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{totalItems}</strong> {itemLabel}
          </span>
        ) : (
          <span>
            Page <strong className="text-slate-900 dark:text-white font-mono">{currentPage}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{totalPages}</strong>
            {totalItems > 0 && (
              <span className="ml-1 text-slate-400 font-normal">({totalItems} {itemLabel} found)</span>
            )}
          </span>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* Previous Button */}
        <button
          type="button"
          disabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-[#0A0F1D] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1E293B] active:scale-95 shadow-sm"
          title="Previous page"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Desktop Page Numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((p) => {
            if (p === 'ellipsis-left' || p === 'ellipsis-right') {
              return (
                <span key={p} className="px-2 py-1 text-slate-400 text-xs font-bold select-none">
                  ...
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                disabled={loading}
                onClick={() => onPageChange(p)}
                className={`min-w-8 h-8 px-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#00DF81] text-[#071911] shadow-md shadow-emerald-500/25 font-black scale-105'
                    : 'bg-slate-100 dark:bg-[#0A0F1D] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1E293B]'
                }`}
                aria-label={`Go to page ${p}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Mobile Page Display */}
        <div className="sm:hidden flex items-center px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#0A0F1D] rounded-lg border border-slate-200 dark:border-[#1E293B]">
          {currentPage} / {totalPages}
        </div>

        {/* Next Button */}
        <button
          type="button"
          disabled={currentPage >= totalPages || loading}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-[#0A0F1D] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1E293B] active:scale-95 shadow-sm"
          title="Next page"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
