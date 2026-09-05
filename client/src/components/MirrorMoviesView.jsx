import React, { useState, useEffect } from 'react';
import { 
  Film, 
  RefreshCw, 
  CloudDownload, 
  ListOrdered, 
  Copy, 
  Check, 
  AlertCircle, 
  ShieldAlert, 
  Flame, 
  ChevronDown,
  Layers
} from 'lucide-react';
import api from '../api/client';
import { isOversizedForSeedr } from '../utils/magnet';

export default function MirrorMoviesView({
  onAddMagnet,
  onAddToQueue,
  onShowToast
}) {
  const [topReleases, setTopReleases] = useState([]);
  const [allMovies, setAllMovies] = useState([]);
  const [viewMode, setViewMode] = useState('top'); // 'top' | 'all'
  const [loading, setLoading] = useState(true);
  const [rediscovering, setRediscovering] = useState(false);
  const [error, setError] = useState(null);
  const [mirrorStatus, setMirrorStatus] = useState(null);

  // Per-movie loading state for fetching links on demand (e.g. for forum topics)
  const [loadingLinksMap, setLoadingLinksMap] = useState({});

  // Copied state tracker
  const [copiedId, setCopiedId] = useState(null);

  const fetchMovies = async (refresh = false) => {
    try {
      if (refresh) setRediscovering(true);
      else setLoading(true);
      setError(null);

      const res = await api.get(`/mirror/movies${refresh ? '?refresh=true' : ''}`);
      if (res.data?.success) {
        const top = res.data.topReleases || res.data.movies || [];
        const all = res.data.allMovies || top;
        setTopReleases(top);
        setAllMovies(all);
        setMirrorStatus({
          domain: res.data.domain,
          keyword: res.data.keyword,
          engine: res.data.searchEngine,
          lastUpdated: res.data.lastUpdated,
          cached: res.data.cachedDomain
        });
      } else {
        setError(res.data?.error || 'Failed to load movie listings');
        if (res.data?.domain) {
          setMirrorStatus(prev => ({ ...(prev || {}), domain: res.data.domain }));
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error fetching movies';
      setError(msg);
      if (err.response?.data?.status) {
        const st = err.response.data.status;
        setMirrorStatus({
          domain: st.activeDomain,
          keyword: st.configuredKeyword,
          engine: st.searchEngine
        });
      }
    } finally {
      setLoading(false);
      setRediscovering(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const handleCopy = (magnet, id) => {
    if (!magnet) return;
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    onShowToast?.('Magnet link copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleFetchMovieLinks = async (movie) => {
    if (!movie.detailUrl) return;
    try {
      setLoadingLinksMap(prev => ({ ...prev, [movie.id]: true }));
      const res = await api.get(`/mirror/detail?url=${encodeURIComponent(movie.detailUrl)}`);
      if (res.data?.success && res.data.details) {
        const details = res.data.details;
        const updater = (m) => {
          if (m.id === movie.id || (m.detailUrl && m.detailUrl === movie.detailUrl)) {
            return {
              ...m,
              magnet: details.magnet || m.magnet,
              magnets: details.magnets || [],
              poster: details.poster || m.poster,
              hasDetailPending: false
            };
          }
          return m;
        };
        setTopReleases(prev => prev.map(updater));
        setAllMovies(prev => prev.map(updater));
      }
    } catch (err) {
      onShowToast?.('Failed to fetch download links: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoadingLinksMap(prev => ({ ...prev, [movie.id]: false }));
    }
  };

  const displayedMovies = viewMode === 'top' ? topReleases : allMovies;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner & Control Bar */}
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-[#00DF81] rounded-xl border border-emerald-500/20">
                <Film className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Top Releases • 1TamilMV
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-[#00DF81] border border-emerald-500/30">
                DIRECT DOWNLOAD LINKS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Latest releases from the active mirror with direct links, qualities, file sizes, and one-click Seedr cloud download.
            </p>
          </div>

          {/* Mirror Status Pill & Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            {mirrorStatus?.domain ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-[#00DF81] animate-pulse" />
                <span className="font-mono text-[#00DF81] font-semibold truncate max-w-[180px]">
                  {mirrorStatus.domain.replace(/^https?:\/\//, '')}
                </span>
                {mirrorStatus.engine && (
                  <span className="text-[10px] text-slate-500 border-l border-slate-700 pl-2">
                    {mirrorStatus.engine}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>No domain discovered</span>
              </div>
            )}

            <button
              onClick={() => fetchMovies(true)}
              disabled={rediscovering || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
              title="Force re-query search engine to find newest mirror"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rediscovering ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Rediscover</span>
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Switcher: Top Releases vs All Movies (No filters) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111927] p-2.5 sm:p-3 rounded-2xl border border-[#1E293B]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('top')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'top'
                ? 'bg-[#00DF81] text-[#071911] shadow-md shadow-emerald-500/25'
                : 'bg-[#0A0F1D] text-slate-300 hover:text-white border border-[#1E293B]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Top Releases</span>
            {topReleases.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {topReleases.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'all'
                ? 'bg-[#00DF81] text-[#071911] shadow-md shadow-emerald-500/25'
                : 'bg-[#0A0F1D] text-slate-300 hover:text-white border border-[#1E293B]'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-emerald-400" />
            <span>All Movies & Releases</span>
            {allMovies.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {allMovies.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:block">
          {viewMode === 'top'
            ? `Displaying ${topReleases.length} curated top releases with direct download links`
            : `Showing ${allMovies.length} releases across all categories`}
        </div>
      </div>

      {/* Error / Cloudflare Notice */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-300">Mirror Access Notice</h4>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              {error}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Tip: Click <strong>"Rediscover"</strong> above to refresh and query the latest mirror domain.
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="w-full aspect-[16/9] bg-slate-800 rounded-xl" />
              <div className="h-4 bg-slate-800 rounded w-3/4" />
              <div className="space-y-2 pt-2">
                <div className="h-10 bg-slate-800 rounded-lg w-full" />
                <div className="h-10 bg-slate-800 rounded-lg w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedMovies.length === 0 && (
        <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Film className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">No Releases Found</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {error || (mirrorStatus?.domain
                ? `Unable to load releases from "${mirrorStatus.domain}". The domain might have changed or is temporarily unreachable.`
                : 'Searching for active mirror and top releases...')}
            </p>
          </div>

          <button
            onClick={() => fetchMovies(true)}
            disabled={rediscovering}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00DF81] hover:bg-[#00c572] text-[#071911] shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${rediscovering ? 'animate-spin' : ''}`} />
            <span>{rediscovering ? 'Rediscovering...' : 'Refresh Releases'}</span>
          </button>
        </div>
      )}

      {/* Movie Cards Grid with Direct Available Links and Sizes */}
      {!loading && displayedMovies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayedMovies.map((movie) => {
            const magnets = (movie.magnets && movie.magnets.length > 0)
              ? movie.magnets
              : (movie.magnet ? [{ magnet: movie.magnet, quality: movie.quality, size: movie.size, title: movie.title }] : []);
            const isFetchingThis = loadingLinksMap[movie.id];

            return (
              <div
                key={movie.id}
                className="bg-[#111927] border border-[#1E293B] hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 group"
              >
                <div>
                  {/* Poster Header */}
                  <div className="relative aspect-[16/9] bg-slate-900 rounded-xl overflow-hidden mb-3.5 border border-slate-800">
                    {movie.poster ? (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : null}

                    {/* Fallback Icon */}
                    <div className="absolute inset-0 flex items-center justify-center text-slate-700 pointer-events-none -z-0">
                      <Film className="w-10 h-10 opacity-30" />
                    </div>

                    {/* Tag / Quality Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-black/75 backdrop-blur-md text-[#00DF81] border border-emerald-500/30 tracking-wider">
                        {movie.quality || 'HD'}
                      </span>
                      {movie.isTopRelease && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-orange-500/25 backdrop-blur-md text-orange-300 border border-orange-500/30 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-400" />
                          TOP
                        </span>
                      )}
                    </div>

                    {/* Available count badge */}
                    {magnets.length > 0 && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-black/75 backdrop-blur-md text-slate-300 border border-slate-700 flex items-center gap-1">
                          <Layers className="w-3 h-3 text-[#00DF81]" />
                          {magnets.length} {magnets.length === 1 ? 'Link' : 'Links'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Movie Title */}
                  <h3
                    className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-[#00DF81] transition-colors mb-3"
                    title={movie.title}
                  >
                    {movie.title}
                  </h3>
                </div>

                {/* Direct Available Links and Sizes List */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CloudDownload className="w-3.5 h-3.5" />
                      Available Links & Sizes
                    </span>
                    {magnets.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        {magnets.length} available
                      </span>
                    )}
                  </div>

                  {magnets.length > 0 ? (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                      {magnets.map((link, lIdx) => {
                        const isOversized = link.size && isOversizedForSeedr(link.size);
                        const isCopied = copiedId === `${movie.id}-${lIdx}`;
                        const magnetTitle = link.title || movie.title;
                        const displaySize = link.size || 'Direct';

                        return (
                          <div
                            key={lIdx}
                            className="p-2 sm:p-2.5 rounded-xl bg-[#0A0F1D] border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-center justify-between gap-2"
                          >
                            {/* Left: Quality Badge & Exact Size */}
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-[#00DF81] border border-emerald-500/25 shrink-0">
                                {link.quality || 'HD'}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold ${isOversized ? 'text-amber-400' : 'text-slate-200'} shrink-0`}>
                                    {displaySize}
                                  </span>
                                  {isOversized && (
                                    <span className="text-[9px] font-semibold text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 shrink-0">
                                      &gt; 4.5 GB
                                    </span>
                                  )}
                                </div>
                                {link.title && link.title !== movie.title && (
                                  <p className="text-[10px] text-slate-500 truncate max-w-[120px] sm:max-w-[160px]" title={link.title}>
                                    {link.title}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Add to Seedr Cloud */}
                              <button
                                onClick={() => onAddMagnet(link.magnet, magnetTitle, link.size)}
                                disabled={isOversized}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  isOversized
                                    ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800'
                                    : 'bg-[#00DF81] hover:bg-[#00c572] text-[#071911] shadow-md shadow-emerald-500/20 active:scale-95'
                                }`}
                                title={isOversized ? 'Exceeds Seedr 4.5 GB limit (use Queue)' : 'Add directly to Seedr Cloud'}
                              >
                                <CloudDownload className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden xs:inline">Seedr</span>
                              </button>

                              {/* Queue */}
                              <button
                                onClick={() => onAddToQueue(link.magnet, magnetTitle, link.size)}
                                className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-colors active:scale-95"
                                title="Schedule in Queue"
                              >
                                <ListOrdered className="w-3.5 h-3.5" />
                              </button>

                              {/* Copy Magnet Link */}
                              <button
                                onClick={() => handleCopy(link.magnet, `${movie.id}-${lIdx}`)}
                                className="p-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                                title="Copy Magnet Link"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Movie has detail pending */
                    <button
                      onClick={() => handleFetchMovieLinks(movie)}
                      disabled={isFetchingThis}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-all disabled:opacity-50"
                    >
                      {isFetchingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                          <span>Fetching links & sizes...</span>
                        </>
                      ) : (
                        <>
                          <CloudDownload className="w-3.5 h-3.5 text-sky-400" />
                          <span>View Available Links & Sizes</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More / Show All Button when in Top Releases view */}
      {!loading && viewMode === 'top' && allMovies.length > topReleases.length && (
        <div className="pt-2 text-center">
          <button
            onClick={() => setViewMode('all')}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-[#111927] hover:bg-[#162134] text-[#00DF81] border border-emerald-500/30 hover:border-emerald-500/60 shadow-lg shadow-black/20 transition-all active:scale-95 group"
          >
            <Film className="w-4 h-4 text-[#00DF81] group-hover:scale-110 transition-transform" />
            <span>Load More / Show All Latest Movies ({allMovies.length - topReleases.length} more)</span>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* Switch back to Top Releases button when in All Movies view */}
      {!loading && viewMode === 'all' && (
        <div className="pt-2 text-center">
          <button
            onClick={() => setViewMode('top')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#111927] hover:bg-[#162134] text-slate-300 border border-slate-700 transition-all active:scale-95"
          >
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Show Top Releases Only ({topReleases.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}
