import React, { useState, useEffect, useMemo } from 'react';
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
  Layers,
  Sparkles,
  Settings,
  Loader2
} from 'lucide-react';
import api from '../api/client';
import { isOversizedForSeedr } from '../utils/magnet';

export default function MirrorMoviesView({
  onAddMagnet,
  onAddToQueue,
  onShowToast,
  onOpenSettings,
  searchQuery = '',
  onSearchChange = null
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

  // Per-movie selected language tab (for movies with multiple language releases)
  const [selectedLangMap, setSelectedLangMap] = useState({});

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
        const currentDomain = res.data.domain;

        // If domain is empty or no releases loaded on landing, auto-initiate rediscovery!
        if (!refresh && (!currentDomain || currentDomain.trim() === '' || top.length === 0)) {
          console.log('[MirrorView] Domain is empty or no releases loaded on landing, auto-initiating rediscovery...');
          return fetchMovies(true);
        }

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
        if (!refresh) {
          console.log('[MirrorView] Fetch failed on landing, auto-initiating rediscovery...');
          return fetchMovies(true);
        }
        setError(res.data?.error || 'Failed to load movie listings');
        if (res.data?.domain) {
          setMirrorStatus(prev => ({ ...(prev || {}), domain: res.data.domain }));
        }
      }
    } catch (err) {
      if (!refresh) {
        console.log('[MirrorView] Exception on landing, auto-initiating rediscovery...');
        return fetchMovies(true);
      }
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
    const urlsToFetch = movie.detailUrls?.length ? movie.detailUrls : (movie.detailUrl ? [movie.detailUrl] : []);
    if (urlsToFetch.length === 0) return;

    try {
      setLoadingLinksMap(prev => ({ ...prev, [movie.id]: true }));
      const detailsList = await Promise.allSettled(
        urlsToFetch.map(u => api.get(`/mirror/detail?url=${encodeURIComponent(u)}`))
      );

      const combinedMagnets = [...(movie.magnets || [])];
      let resolvedPoster = movie.poster;

      for (const res of detailsList) {
        if (res.status === 'fulfilled' && res.value.data?.success && res.value.data.details) {
          const d = res.value.data.details;
          if (d.poster && !resolvedPoster) resolvedPoster = d.poster;
          if (Array.isArray(d.magnets)) {
            for (const m of d.magnets) {
              const exists = combinedMagnets.some(x => 
                (m.infoHash && x.infoHash === m.infoHash) || (m.magnet && x.magnet === m.magnet)
              );
              if (!exists) combinedMagnets.push(m);
            }
          }
        }
      }

      const updater = (m) => {
        if (m.id === movie.id || (m.title && m.title === movie.title)) {
          return {
            ...m,
            poster: resolvedPoster,
            magnets: combinedMagnets,
            hasDetailPending: false
          };
        }
        return m;
      };

      setTopReleases(prev => prev.map(updater));
      setAllMovies(prev => prev.map(updater));
    } catch (err) {
      onShowToast?.('Failed to fetch download links: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoadingLinksMap(prev => ({ ...prev, [movie.id]: false }));
    }
  };

  // Group movies by title so each movie appears only once with all its available sizes/languages
  const displayedMovies = useMemo(() => {
    const list = viewMode === 'top' ? topReleases : allMovies;
    if (!Array.isArray(list)) return [];

    const map = new Map();
    for (const item of list) {
      const title = item.title || '';
      const yearMatch = title.match(/^(.*?)\s*\((\d{4})\)/i);
      let base = '';
      let year = '';
      if (yearMatch) {
        base = yearMatch[1].trim();
        year = yearMatch[2];
      } else {
        base = title.split(/[-–—\[]/)[0].replace(/\b(Tamil|Telugu|Hindi|Malayalam|Kannada|English)\b/gi, '').trim();
      }
      const langMatch = title.match(/\b(Tamil|Telugu|Hindi|Malayalam|Kannada|English)\b/i);
      const language = langMatch ? (langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase()) : '';
      const cleanBase = base.replace(/[-–—]\s*$/, '').trim();
      const displayTitle = cleanBase + (year ? ` (${year})` : '');
      const groupKey = (displayTitle || title).toLowerCase().replace(/[^a-z0-9]/g, '');

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          ...item,
          id: item.id || `group-${groupKey}`,
          title: displayTitle || item.title,
          rawTitle: item.title,
          year,
          languages: item.languages?.length ? [...item.languages] : (language ? [language] : []),
          magnets: [...(item.magnets || [])]
        });
      } else {
        const group = map.get(groupKey);
        if (!group.poster && item.poster) group.poster = item.poster;
        if (language && !group.languages.includes(language)) {
          group.languages.push(language);
        }
        if (item.languages) {
          for (const l of item.languages) {
            if (!group.languages.includes(l)) group.languages.push(l);
          }
        }
        const incoming = (item.magnets && item.magnets.length > 0)
          ? item.magnets
          : (item.magnet ? [{ magnet: item.magnet, quality: item.quality, size: item.size, title: item.title, language }] : []);

        for (const m of incoming) {
          const magLang = m.language || language || '';
          const already = group.magnets.some(x => 
            (m.infoHash && x.infoHash && x.infoHash === m.infoHash) || 
            (m.magnet && x.magnet && x.magnet === m.magnet) ||
            (m.quality === x.quality && m.size === x.size && (x.language === magLang))
          );
          if (!already) {
            group.magnets.push({
              ...m,
              language: magLang
            });
          }
        }
        if (group.magnets.length > 0) {
          group.hasDetailPending = false;
        }
      }
    }

    let result = Array.from(map.values());
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(m => 
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.rawTitle && m.rawTitle.toLowerCase().includes(q)) ||
        (m.year && m.year.includes(q)) ||
        (m.languages && m.languages.some(l => l.toLowerCase().includes(q))) ||
        (m.quality && m.quality.toLowerCase().includes(q)) ||
        (m.magnets && m.magnets.some(link => 
          (link.title && link.title.toLowerCase().includes(q)) ||
          (link.quality && link.quality.toLowerCase().includes(q)) ||
          (link.language && link.language.toLowerCase().includes(q))
        ))
      );
    }
    return result;
  }, [topReleases, allMovies, viewMode, searchQuery]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner & Control Bar */}
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
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
                ONE-CLICK SEEDR CLOUD
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Each movie is shown once with all its available download qualities, file sizes, and 1-click Seedr cloud download.
            </p>
          </div>

          {/* Mirror Status Pill & Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            {loading || rediscovering ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00DF81]" />
                <span className="font-semibold text-[#00DF81]">Scraping 1TamilMV website...</span>
              </div>
            ) : mirrorStatus?.domain ? (
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

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00DF81]/15 hover:bg-[#00DF81]/25 text-[#00DF81] border border-[#00DF81]/30 transition-all active:scale-95"
                title="Configure search keyword and mirror settings"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View Mode Switcher: Top Releases vs All Movies */}
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
            {displayedMovies.length > 0 && viewMode === 'top' && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {displayedMovies.length}
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
            {displayedMovies.length > 0 && viewMode === 'all' && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {displayedMovies.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:block">
          {loading || rediscovering
            ? 'Scraping 1TamilMV website for latest releases...'
            : viewMode === 'top'
              ? `Showing ${displayedMovies.length} unique top releases with all qualities & sizes`
              : `Showing ${displayedMovies.length} unique releases across all categories`}
        </div>
      </div>

      {/* Active Search Query Filter Pill */}
      {searchQuery && searchQuery.trim() && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#090F1C] border border-[#1E293B] rounded-xl text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Filtering mirror by:</span>
            <span className="font-bold text-[#00DF81] bg-[#00DF81]/10 px-2 py-0.5 rounded-md border border-[#00DF81]/20">
              "{searchQuery}"
            </span>
            <span className="text-slate-500">
              ({displayedMovies.length} {displayedMovies.length === 1 ? 'match' : 'matches'})
            </span>
          </div>
          {onSearchChange && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-xs text-slate-400 hover:text-white underline ml-auto"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

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
              Tip: Click <strong>"Rediscover"</strong> above or check <strong>Settings</strong> to update the mirror domain.
            </p>
          </div>
        </div>
      )}

      {/* Loading / Scraping State */}
      {(loading || rediscovering) && (
        <div className="space-y-6">
          <div className="bg-[#111927] border border-emerald-500/20 rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden shadow-xl shadow-black/20">
            <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-md mx-auto space-y-3">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-ping opacity-60" />
                <div className="relative w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00DF81]">
                  <Film className="w-7 h-7 animate-pulse" />
                </div>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center justify-center gap-2">
                  <span>Scraping 1TamilMV Website...</span>
                  <Loader2 className="w-4 h-4 animate-spin text-[#00DF81]" />
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Connecting to active mirror, extracting top releases, audio languages, download qualities, and multi-resolution magnet streams...
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81] animate-ping" />
                <span>Auto-discovering domain & parsing movie forum</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 space-y-3 animate-pulse">
                <div className="w-full aspect-[16/9] bg-slate-800/60 rounded-xl" />
                <div className="h-4 bg-slate-800/60 rounded w-3/4" />
                <div className="space-y-2 pt-2">
                  <div className="h-10 bg-slate-800/50 rounded-lg w-full" />
                  <div className="h-10 bg-slate-800/50 rounded-lg w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedMovies.length === 0 && (
        <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Film className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {searchQuery && searchQuery.trim() ? `No releases matching "${searchQuery}"` : 'No Releases Found'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {searchQuery && searchQuery.trim() ? (
                viewMode === 'top' 
                  ? `No matching releases in Top Releases. Would you like to check across All Movies & Releases (${allMovies.length} total)?`
                  : `No releases matching "${searchQuery}" found on ${mirrorStatus?.domain || 'the mirror'}.`
              ) : (
                error || (mirrorStatus?.domain
                  ? `Unable to load releases from "${mirrorStatus.domain}". The domain might have changed or is temporarily unreachable.`
                  : 'Searching for active mirror and top releases...')
              )}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {searchQuery && searchQuery.trim() && viewMode === 'top' && (
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00DF81] text-[#071911] shadow-lg shadow-emerald-500/20"
              >
                <Film className="w-4 h-4" />
                <span>Search in All Movies & Releases</span>
              </button>
            )}

            {searchQuery && searchQuery.trim() && onSearchChange && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                <span>Clear Search</span>
              </button>
            )}

            {(!searchQuery || !searchQuery.trim()) && (
              <button
                onClick={() => fetchMovies(true)}
                disabled={rediscovering}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00DF81] hover:bg-[#00c572] text-[#071911] shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${rediscovering ? 'animate-spin' : ''}`} />
                <span>{rediscovering ? 'Rediscovering...' : 'Refresh Releases'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Movie Cards Grid */}
      {!loading && displayedMovies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayedMovies.map((movie) => {
            const activeLang = selectedLangMap[movie.id] || 'ALL';
            const hasMultipleLangs = movie.languages && movie.languages.length > 1;

            const magnets = (movie.magnets && movie.magnets.length > 0)
              ? movie.magnets
              : (movie.magnet ? [{ magnet: movie.magnet, quality: movie.quality, size: movie.size, title: movie.title, language: movie.languages?.[0] || '' }] : []);

            const visibleMagnets = (!hasMultipleLangs || activeLang === 'ALL')
              ? magnets
              : magnets.filter(m => !m.language || m.language.toLowerCase() === activeLang.toLowerCase());

            const isFetchingThis = loadingLinksMap[movie.id];
            const uniqueQualities = Array.from(new Set(magnets.map(m => m.quality).filter(Boolean)));

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

                    {/* Total Available Links Count */}
                    {magnets.length > 0 && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-black/75 backdrop-blur-md text-slate-300 border border-slate-700 flex items-center gap-1">
                          <Layers className="w-3 h-3 text-[#00DF81]" />
                          {magnets.length} {magnets.length === 1 ? 'Link' : 'Links'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clean Movie Title */}
                  <h3
                    className="text-base sm:text-lg font-bold text-white line-clamp-2 leading-snug group-hover:text-[#00DF81] transition-colors mb-2"
                    title={movie.title}
                  >
                    {movie.title}
                  </h3>

                  {/* Available Qualities Summary Pills */}
                  {uniqueQualities.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Resolutions:
                      </span>
                      {uniqueQualities.map(q => (
                        <span
                          key={q}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700"
                        >
                          {q}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Multi-Language / Audio Filter Tabs */}
                  {hasMultipleLangs && (
                    <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-slate-800/60 mb-2.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-0.5">
                        Audio:
                      </span>
                      <button
                        onClick={() => setSelectedLangMap(prev => ({ ...prev, [movie.id]: 'ALL' }))}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                          activeLang === 'ALL'
                            ? 'bg-[#00DF81] text-[#071911] shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                      >
                        All ({magnets.length})
                      </button>
                      {movie.languages.map(lang => {
                        const langCount = magnets.filter(m => m.language?.toLowerCase() === lang.toLowerCase()).length;
                        return (
                          <button
                            key={lang}
                            onClick={() => setSelectedLangMap(prev => ({ ...prev, [movie.id]: lang }))}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                              activeLang.toLowerCase() === lang.toLowerCase()
                                ? 'bg-[#00DF81] text-[#071911] shadow-sm'
                                : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'
                            }`}
                          >
                            {lang} {langCount > 0 ? `(${langCount})` : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Single Language Badge if only one language */}
                  {!hasMultipleLangs && movie.languages?.length === 1 && (
                    <div className="mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                        {movie.languages[0]} Audio
                      </span>
                    </div>
                  )}
                </div>

                {/* Direct Available Links & Sizes List */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 relative z-0">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CloudDownload className="w-3.5 h-3.5" />
                      Available Qualities & Sizes
                    </span>
                    {visibleMagnets.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        {visibleMagnets.length} {visibleMagnets.length === 1 ? 'option' : 'options'}
                      </span>
                    )}
                  </div>

                  {visibleMagnets.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {visibleMagnets.map((link, lIdx) => {
                        const isOversized = link.size && isOversizedForSeedr(link.size);
                        const isCopied = copiedId === `${movie.id}-${lIdx}`;
                        const magnetTitle = link.title || movie.title;
                        const displaySize = link.size || 'Direct';

                        return (
                          <div
                            key={lIdx}
                            className="p-2.5 rounded-xl bg-[#090F1C] border border-[#1E293B] hover:border-slate-700/80 transition-all space-y-2"
                          >
                            {/* Top row: Quality, Size, Audio, and Oversized notice */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider shrink-0 ${
                                  link.quality === '4K' || link.quality === '2160P'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/15 text-[#00DF81] border border-emerald-500/30'
                                }`}>
                                  {link.quality || 'HD'}
                                </span>

                                <span className={`text-xs font-bold font-mono shrink-0 ${isOversized ? 'text-amber-300' : 'text-slate-100'}`}>
                                  {displaySize}
                                </span>

                                {hasMultipleLangs && activeLang === 'ALL' && link.language && (
                                  <span className="text-[10px] font-semibold text-sky-300 bg-sky-500/15 px-1.5 py-0.2 rounded border border-sky-500/30 shrink-0">
                                    {link.language}
                                  </span>
                                )}
                              </div>

                              {isOversized && (
                                <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shrink-0 flex items-center gap-1">
                                  &gt; 4.5 GB Limit
                                </span>
                              )}
                            </div>

                            {/* Bottom row: File description & Action buttons */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                              <div className="min-w-0 flex-1">
                                {link.title && link.title !== movie.title ? (
                                  <p className="text-[10px] text-slate-500 truncate" title={link.title}>
                                    {link.title}
                                  </p>
                                ) : (
                                  <span className="text-[10px] text-slate-500">
                                    {isOversized ? 'Requires queue schedule' : 'Direct Cloud Download'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isOversized ? (
                                  <button
                                    onClick={() => onAddToQueue(link.magnet, magnetTitle, link.size)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                                    title="File exceeds 4.5 GB — Schedule in Queue"
                                  >
                                    <ListOrdered className="w-3.5 h-3.5" />
                                    <span>Queue</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => onAddMagnet(link.magnet, magnetTitle, link.size)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                                      title="Add directly to Seedr Cloud"
                                    >
                                      <CloudDownload className="w-3.5 h-3.5 shrink-0" />
                                      <span>Seedr</span>
                                    </button>

                                    <button
                                      onClick={() => onAddToQueue(link.magnet, magnetTitle, link.size)}
                                      className="p-1.5 rounded-lg text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-colors active:scale-95"
                                      title="Schedule in Queue"
                                    >
                                      <ListOrdered className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                <button
                                  onClick={() => handleCopy(link.magnet, `${movie.id}-${lIdx}`)}
                                  className="p-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                                  title="Copy magnet link"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Detail pending */
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
            <span>Load More / Show All Latest Movies</span>
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
            <span>Show Top Releases Only ({displayedMovies.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}
