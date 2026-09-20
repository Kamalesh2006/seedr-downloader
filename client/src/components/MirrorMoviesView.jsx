import React, { useState, useEffect, useMemo } from 'react';
import { 
  Film, 
  RefreshCw, 
  CloudDownload, 
  Copy, 
  Check, 
  AlertCircle, 
  ShieldAlert, 
  Flame, 
  ChevronDown,
  Layers,
  Sparkles,
  Settings,
  Loader2,
  Clock,
  CheckCircle2,
  Globe,
  LayoutGrid,
  List,
  Search,
  ArrowUp,
  ArrowDown,
  AlertOctagon,
  X,
  Magnet
} from 'lucide-react';
import api from '../api/client';
import { isOversizedForSeedr, ensureMagnetUri } from '../utils/magnet';

function extractMagnetHash(magnet) {
  if (!magnet) return '';
  const match = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
  return match ? match[1].toLowerCase() : '';
}

export default function MirrorMoviesView({
  onAddMagnet,
  onShowToast,
  onOpenSettings,
  searchQuery = '',
  onSearchChange = null,
  queue = [],
  activeTransfers = [],
  publicResultsCount = 0,
  searchLoading = false,
  hasSearched = false,
  onSearch = null
}) {
  const [topReleases, setTopReleases] = useState([]);
  const [allMovies, setAllMovies] = useState([]);
  
  // Tabs: 'top' (1TamilMV Top) | 'all' (1TamilMV All) | 'global' (YTS, TPB, 1337x)
  const [viewMode, setViewMode] = useState('top');
  
  // Layout toggle: 'grid' | 'list'
  const [layoutMode, setLayoutMode] = useState(() => {
    try {
      return localStorage.getItem('seedr_mirror_layout_mode') || 'grid';
    } catch (e) {
      return 'grid';
    }
  });

  const handleLayoutModeChange = (mode) => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('seedr_mirror_layout_mode', mode);
    } catch (e) {}
  };

  const [loading, setLoading] = useState(true);
  const [rediscovering, setRediscovering] = useState(false);
  const [error, setError] = useState(null);
  const [mirrorStatus, setMirrorStatus] = useState(null);

  // Global Search State
  const [globalQuery, setGlobalQuery] = useState(searchQuery || '');
  const [searchInput, setSearchInput] = useState(searchQuery || '');
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [globalHasSearched, setGlobalHasSearched] = useState(false);
  const [globalProviderFilter, setGlobalProviderFilter] = useState('ALL');

  // Sync searchInput when searchQuery prop changes
  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== searchInput) {
      setSearchInput(searchQuery);
      setGlobalQuery(searchQuery);
      if (searchQuery && searchQuery.trim()) {
        setViewMode('global');
      }
    }
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const q = (searchInput || '').trim();
    if (!q) return;
    setGlobalQuery(q);
    onSearchChange?.(q);
    setViewMode('global');
    executeGlobalSearch(q);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setGlobalQuery('');
    setGlobalResults([]);
    setGlobalHasSearched(false);
    onSearchChange?.('');
  };

  const handleQuickSearch = (term) => {
    setSearchInput(term);
    setGlobalQuery(term);
    onSearchChange?.(term);
    setViewMode('global');
    executeGlobalSearch(term);
  };

  // Per-magnet addition tracking & visual queued state
  const [addingMagnet, setAddingMagnet] = useState(null);
  const [localQueuedHashes, setLocalQueuedHashes] = useState(new Set());
  const [localAddedHashes, setLocalAddedHashes] = useState(new Set());

  // Compute set of all queued hashes (from queue prop + local additions)
  const queuedHashSet = useMemo(() => {
    const s = new Set(localQueuedHashes);
    (queue || []).forEach(q => {
      const h = extractMagnetHash(q.magnet);
      if (h) s.add(h);
    });
    return s;
  }, [queue, localQueuedHashes]);

  // Compute set of active download hashes
  const activeHashSet = useMemo(() => {
    const s = new Set(localAddedHashes);
    (activeTransfers || []).forEach(t => {
      const h = (t.hash || extractMagnetHash(t.magnet) || '').toLowerCase();
      if (h) s.add(h);
    });
    return s;
  }, [activeTransfers, localAddedHashes]);

  const handleAddMagnetClick = async (link, magnetTitle) => {
    if (addingMagnet) return;
    const hash = extractMagnetHash(link.magnet);
    setAddingMagnet(link.magnet);

    try {
      const res = await onAddMagnet(link.magnet, magnetTitle, link.size);
      if (res && res.autoQueued) {
        if (hash) {
          setLocalQueuedHashes(prev => new Set([...prev, hash]));
        }
      } else if (res) {
        if (hash) {
          setLocalAddedHashes(prev => new Set([...prev, hash]));
        }
      }
    } catch (err) {
      console.warn('Add magnet error:', err.message);
    } finally {
      setAddingMagnet(null);
    }
  };

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
          return fetchMovies(true);
        }
        setError(res.data?.error || 'Failed to load movie listings');
        if (res.data?.domain) {
          setMirrorStatus(prev => ({ ...(prev || {}), domain: res.data.domain }));
        }
      }
    } catch (err) {
      if (!refresh) {
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

  // Global Search function
  const executeGlobalSearch = async (queryText) => {
    const q = (queryText || globalQuery || '').trim();
    if (!q) return;
    setGlobalLoading(true);
    setGlobalError(null);
    setGlobalHasSearched(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q)}&source=global`);
      const results = res.data?.results || [];
      setGlobalResults(results);
      if (results.length > 0) {
        onShowToast?.(`Found ${results.length} global torrents for "${q}"!`, 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Global search failed';
      setGlobalError(msg);
      setGlobalResults([]);
    } finally {
      setGlobalLoading(false);
    }
  };

  // Sync searchQuery prop if provided and currently in global view
  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      setGlobalQuery(searchQuery);
      if (viewMode === 'global') {
        executeGlobalSearch(searchQuery);
      }
    }
  }, [searchQuery, viewMode]);

  const handleCopy = (magnet, id) => {
    if (!magnet) return;
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    onShowToast?.('Magnet link copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleFetchMovieLinks = async (movie) => {
    const urlsToFetch = movie.detailUrls?.length ? movie.detailUrls : (movie.detailUrl ? [movie.detailUrl] : []);
    if (urlsToFetch.length === 0 && !movie.title) return;

    try {
      setLoadingLinksMap(prev => ({ ...prev, [movie.id]: true }));
      let detailsList = [];
      if (urlsToFetch.length > 0) {
        detailsList = await Promise.allSettled(
          urlsToFetch.map(u => api.get(`/mirror/detail?url=${encodeURIComponent(u)}&title=${encodeURIComponent(movie.title || movie.rawTitle || '')}`))
        );
      } else {
        const res = await api.get(`/mirror/detail?title=${encodeURIComponent(movie.title || movie.rawTitle || '')}`);
        detailsList = [{ status: 'fulfilled', value: res }];
      }

      const combinedMagnets = [...(movie.magnets || [])];

      for (const res of detailsList) {
        if (res.status === 'fulfilled' && res.value.data?.success && res.value.data.details) {
          const d = res.value.data.details;
          if (Array.isArray(d.magnets)) {
            for (const m of d.magnets) {
              const exists = combinedMagnets.some(x => 
                (m.infoHash && x.infoHash && m.infoHash === x.infoHash) || (m.magnet && x.magnet === m.magnet)
              );
              if (!exists) combinedMagnets.push(m);
            }
          }
        }
      }

      const foundCount = combinedMagnets.length;
      if (foundCount > 0) {
        onShowToast?.(`Loaded ${foundCount} download ${foundCount === 1 ? 'option' : 'options'} for ${movie.title}!`, 'success');
      } else {
        onShowToast?.(`Download links not posted yet by provider for "${movie.title}".`, 'info');
      }

      const updater = (m) => {
        const matches = m.id === movie.id || 
                        (m.title && m.title === movie.title) || 
                        (m.rawTitle && m.rawTitle === movie.rawTitle);
        if (matches) {
          return {
            ...m,
            magnets: combinedMagnets,
            hasDetailPending: false,
            linksChecked: true,
            noLinksFound: combinedMagnets.length === 0
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

  // Group movies by title so each movie appears cleanly with all its available sizes/languages
  const displayedMovies = useMemo(() => {
    if (viewMode === 'global') return [];
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
          magnets: [...(item.magnets || [])],
          detailUrls: item.detailUrls ? [...item.detailUrls] : (item.detailUrl ? [item.detailUrl] : []),
          linksChecked: !!item.linksChecked,
          noLinksFound: !!item.noLinksFound
        });
      } else {
        const group = map.get(groupKey);
        if (item.linksChecked) group.linksChecked = true;
        if (item.noLinksFound && group.magnets.length === 0) group.noLinksFound = true;
        if (item.detailUrl && !group.detailUrls.includes(item.detailUrl)) {
          group.detailUrls.push(item.detailUrl);
        }
        if (item.detailUrls) {
          for (const u of item.detailUrls) {
            if (!group.detailUrls.includes(u)) group.detailUrls.push(u);
          }
        }
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
            (m.magnet && x.magnet === m.magnet) ||
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
    const activeSearch = (searchInput || searchQuery || globalQuery || '').toLowerCase().trim();
    if (activeSearch) {
      result = result.filter(m => 
        (m.title && m.title.toLowerCase().includes(activeSearch)) ||
        (m.rawTitle && m.rawTitle.toLowerCase().includes(activeSearch)) ||
        (m.year && m.year.includes(activeSearch)) ||
        (m.languages && m.languages.some(l => l.toLowerCase().includes(activeSearch))) ||
        (m.quality && m.quality.toLowerCase().includes(activeSearch)) ||
        (m.magnets && m.magnets.some(link => 
          (link.title && link.title.toLowerCase().includes(activeSearch)) ||
          (link.quality && link.quality.toLowerCase().includes(activeSearch)) ||
          (link.language && link.language.toLowerCase().includes(activeSearch))
        ))
      );
    }
    return result;
  }, [topReleases, allMovies, viewMode, searchQuery, searchInput, globalQuery]);

  // Filtered Global Results
  const filteredGlobalResults = useMemo(() => {
    if (globalProviderFilter === 'ALL') return globalResults;
    return globalResults.filter(r => (r.provider || '').toLowerCase() === globalProviderFilter.toLowerCase());
  }, [globalResults, globalProviderFilter]);

  const globalProvidersList = useMemo(() => {
    const set = new Set(globalResults.map(r => r.provider || 'Public Torrent'));
    return Array.from(set);
  }, [globalResults]);

  return (
    <div className="space-y-5 pb-12 max-w-7xl mx-auto">
      {/* Header Bar: Search Input + Source Info + Sub-navigation tabs */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-emerald-500/10 text-[#00DF81] rounded-xl border border-emerald-500/20 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Torrent & Movie Search
                </h1>
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-[#00DF81] border border-emerald-500/25">
                  Multi-Indexer
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Search millions of torrents across YTS, 1337x, ThePirateBay, and regional mirror releases
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 self-start sm:self-auto">
            {mirrorStatus?.domain && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#00DF81] shrink-0" />
                <span className="font-mono text-emerald-600 dark:text-[#00DF81] font-semibold truncate max-w-[150px]">
                  {mirrorStatus.domain.replace(/^https?:\/\//, '')}
                </span>
              </div>
            )}

            <button
              onClick={() => fetchMovies(true)}
              disabled={rediscovering || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50"
              title="Rediscover newest mirror"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rediscovering ? 'animate-spin text-emerald-500' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00DF81]/15 hover:bg-[#00DF81]/25 text-[#00DF81] border border-[#00DF81]/30 transition-all active:scale-95"
                title="Configure mirror settings"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Prominent Full-Width Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 pointer-events-none" />
            <input 
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search movies, TV shows, anime, games, or release titles..."
              className="w-full bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl pl-12 pr-32 py-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00DF81] focus:ring-2 focus:ring-[#00DF81]/20 transition-all shadow-inner"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                  title="Clear"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={globalLoading}
                className="px-3 sm:px-4 py-2 bg-[#00DF81] hover:bg-[#00DF81]/90 text-[#071911] font-bold text-xs sm:text-sm rounded-lg shadow-md shadow-emerald-500/25 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                {globalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Search</span>
              </button>
            </div>
          </div>
        </form>

        {/* Quick Search Tags / Trending Chips */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Popular:</span>
          </span>
          {['Latest Releases', '1080p Movies', 'Tamil 2024', 'Malayalam', 'Telugu', 'Hindi', 'Web Series', '4K HEVC'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleQuickSearch(tag)}
              className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-[#00DF81]/15 hover:text-[#00DF81] hover:border-[#00DF81]/30 border border-slate-200 dark:border-slate-700/60 transition-all active:scale-95"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Navigation Tabs (Top Releases | All Releases | Global Search) & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-[#1E293B]">
          {/* Stack tabs on mobile; switch to a horizontal tab row on larger screens */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('top')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all w-full sm:w-auto sm:shrink-0 whitespace-nowrap ${
                viewMode === 'top'
                  ? 'bg-[#00DF81] text-[#071911] shadow-md shadow-emerald-500/25'
                  : 'bg-slate-100 dark:bg-[#0A0F1D] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1E293B]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
              <span>Top Releases</span>
              {displayedMovies.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  viewMode === 'top' ? 'bg-[#071911]/20 text-[#071911]' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {displayedMovies.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all w-full sm:w-auto sm:shrink-0 whitespace-nowrap ${
                viewMode === 'all'
                  ? 'bg-[#00DF81] text-[#071911] shadow-md shadow-emerald-500/25'
                  : 'bg-slate-100 dark:bg-[#0A0F1D] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1E293B]'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>All Releases</span>
              {allMovies.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  viewMode === 'all' ? 'bg-[#071911]/20 text-[#071911]' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {allMovies.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('global');
                if (searchInput && (!globalResults || globalResults.length === 0)) {
                  executeGlobalSearch(searchInput);
                }
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all w-full sm:w-auto sm:shrink-0 whitespace-nowrap ${
                viewMode === 'global'
                  ? 'bg-[#00DF81] text-[#071911] shadow-md shadow-emerald-500/25'
                  : 'bg-slate-100 dark:bg-[#0A0F1D] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1E293B]'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span>Global Search</span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                YTS • 1337x • PirateBay
              </span>
            </button>
          </div>

          {/* View Controls: Item Count (Mobile) & Grid vs List Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-0.5 sm:pt-0">
            {/* Context label for mobile view */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium sm:hidden min-w-0 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00DF81] shrink-0" />
              <span className="truncate">
                {viewMode === 'top'
                  ? `${displayedMovies.length} Top Releases`
                  : viewMode === 'all'
                  ? `${allMovies.length} Forum Releases`
                  : `${filteredGlobalResults.length} Torrents`}
              </span>
            </div>

            {/* Grid vs List View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0A0F1D] p-1 rounded-xl border border-slate-200 dark:border-[#1E293B] shrink-0">
              <button
                type="button"
                onClick={() => handleLayoutModeChange('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  layoutMode === 'grid'
                    ? 'bg-white dark:bg-[#1E293B] text-[#00DF81] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => handleLayoutModeChange('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  layoutMode === 'list'
                    ? 'bg-white dark:bg-[#1E293B] text-[#00DF81] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GLOBAL SEARCH VIEW */}
      {viewMode === 'global' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Active Global Search Query Header */}
          {(globalQuery || searchQuery) && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 dark:text-slate-400">Global Search Query:</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-500/20">
                  "{globalQuery || searchQuery}"
                </span>
                {globalResults.length > 0 && (
                  <span className="text-slate-500">
                    ({globalResults.length} {globalResults.length === 1 ? 'torrent found' : 'torrents found'})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => executeGlobalSearch(globalQuery || searchQuery)}
                  disabled={globalLoading}
                  className="inline-flex items-center gap-1 text-xs text-[#00DF81] hover:underline font-semibold"
                >
                  <RefreshCw className={`w-3 h-3 ${globalLoading ? 'animate-spin' : ''}`} />
                  <span>Re-search</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGlobalQuery('');
                    setGlobalResults([]);
                    setGlobalHasSearched(false);
                    onSearchChange?.('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white underline ml-1"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}

          {/* Provider Filter Tabs (if results exist) */}
          {globalResults.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-xl px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Filter Provider:</span>
                <button
                  onClick={() => setGlobalProviderFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    globalProviderFilter === 'ALL'
                      ? 'bg-[#00DF81] text-[#071911]'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-white'
                  }`}
                >
                  All ({globalResults.length})
                </button>
                {globalProvidersList.map((p) => {
                  const count = globalResults.filter(r => (r.provider || '').toLowerCase() === p.toLowerCase()).length;
                  return (
                    <button
                      key={p}
                      onClick={() => setGlobalProviderFilter(p)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        globalProviderFilter.toLowerCase() === p.toLowerCase()
                          ? 'bg-[#00DF81] text-[#071911]'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-white'
                      }`}
                    >
                      {p} ({count})
                    </button>
                  );
                })}
              </div>

              <span className="text-slate-500 font-mono text-[11px]">
                Showing {filteredGlobalResults.length} of {globalResults.length}
              </span>
            </div>
          )}

          {/* Loading Indicator */}
          {globalLoading && (
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-8 text-center space-y-3">
              <div className="flex items-center justify-center gap-2.5">
                <Loader2 className="w-5 h-5 animate-spin text-[#00DF81]" />
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Searching YTS, ThePirateBay & 1337x for "{globalQuery}"...
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fetching torrent links, active seeds, resolutions, and direct magnet links...
              </p>
            </div>
          )}

          {/* Error Message */}
          {globalError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-medium">
              {globalError}
            </div>
          )}

          {/* Empty State */}
          {!globalLoading && globalHasSearched && filteredGlobalResults.length === 0 && (
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-8 text-center space-y-3">
              <p className="text-base font-bold text-slate-900 dark:text-white">
                No global torrents found for "{globalQuery}".
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Try searching with a shorter title keyword, checking spelling, or browsing our regional 1TamilMV releases.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('top')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#00DF81] text-[#071911] shadow-md shadow-emerald-500/20"
              >
                <Flame className="w-4 h-4" />
                <span>View 1TamilMV Top Releases</span>
              </button>
            </div>
          )}

          {/* Initial Welcome State (Before any search) */}
          {!globalLoading && !globalHasSearched && (
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center">
                <Globe className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Global Public Torrent Indexers
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Type any movie or show title in the search box above to get instant results from <strong>YTS.mx</strong>, <strong>ThePirateBay</strong>, and <strong>1337x</strong>.
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2 max-w-lg mx-auto">
                <span className="text-slate-400 text-xs font-semibold">Try popular:</span>
                {['Inception', 'Avatar', 'Interstellar', 'Spider-Man', 'Oppenheimer', 'Deadpool', 'Batman'].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      if (onSearch) {
                        onSearch(term);
                      } else {
                        executeGlobalSearch(term);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-[#0A0F1D] text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-[#00DF81] border border-slate-200 dark:border-[#1E293B] hover:border-[#00DF81]/40 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Global Search Results - GRID VIEW */}
          {!globalLoading && layoutMode === 'grid' && filteredGlobalResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredGlobalResults.map((torrent, idx) => {
                const isOversized = torrent.size && isOversizedForSeedr(torrent.size);
                const torrentHash = extractMagnetHash(torrent.magnet);
                const isAddingThis = addingMagnet === torrent.magnet;
                const isQueued = queuedHashSet.has(torrentHash);
                const isDownloading = activeHashSet.has(torrentHash);
                const isCopied = copiedId === `global-${idx}`;

                return (
                  <div
                    key={`g-grid-${idx}`}
                    className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/5 group"
                  >
                    <div>
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          torrent.provider === 'YTS'
                            ? 'bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30'
                            : torrent.provider === 'ThePirateBay'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                              : torrent.provider === 'TorrentsCSV'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30'
                                : torrent.provider === '1337x'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-[#00DF81] dark:border-emerald-500/30'
                        }`}>
                          {torrent.provider}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-[#00DF81]">
                            <ArrowUp className="w-3 h-3" /> {torrent.seeds || 0}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
                            <ArrowDown className="w-3 h-3" /> {torrent.leeches || 0}
                          </span>
                        </div>
                      </div>

                      {/* Clean Movie Title */}
                      <h3 
                        className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-emerald-600 dark:group-hover:text-[#00DF81] transition-colors mb-3"
                        title={torrent.title}
                      >
                        {torrent.title}
                      </h3>
                    </div>

                    {/* Bottom Action Section */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-[#1E293B]/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono font-bold ${isOversized ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {torrent.size}
                        </span>

                        {isOversized && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            &gt; 4.5 GB Limit
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isAddingThis ? (
                          <button disabled className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-[#00DF81] border border-emerald-500/30 flex items-center justify-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Adding...</span>
                          </button>
                        ) : isQueued ? (
                          <span className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>In Queue</span>
                          </span>
                        ) : isDownloading ? (
                          <span className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-[#00DF81] border border-emerald-500/30 flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#00DF81]" />
                            <span>In Cloud</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddMagnetClick(torrent, torrent.title)}
                            disabled={isOversized}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              isOversized
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                                : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-md shadow-emerald-500/20 active:scale-95'
                            }`}
                            title={isOversized ? 'Exceeds 4.5 GB Cloud Limit' : 'Add to Cloud'}
                          >
                            <CloudDownload className="w-3.5 h-3.5 shrink-0" />
                            <span>Add to Cloud</span>
                          </button>
                        )}

                        {torrent.magnet && (
                          <a
                            href={ensureMagnetUri(torrent.magnet, torrent.title)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowToast?.('Opening torrent app...', 'info');
                            }}
                            className="p-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition-all hover:scale-105 active:scale-95"
                            title="Open in Torrent App (Soft link)"
                          >
                            <Magnet className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          onClick={() => handleCopy(torrent.magnet, `global-${idx}`)}
                          className="p-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#090F1C] dark:hover:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-[#1E293B] transition-colors"
                          title="Copy magnet link"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-[#00DF81]" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Global Search Results - LIST VIEW */}
          {!globalLoading && layoutMode === 'list' && filteredGlobalResults.length > 0 && (
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl divide-y divide-slate-100 dark:divide-[#1E293B] shadow-sm overflow-hidden">
              {filteredGlobalResults.map((torrent, idx) => {
                const isOversized = torrent.size && isOversizedForSeedr(torrent.size);
                const torrentHash = extractMagnetHash(torrent.magnet);
                const isAddingThis = addingMagnet === torrent.magnet;
                const isQueued = queuedHashSet.has(torrentHash);
                const isDownloading = activeHashSet.has(torrentHash);
                const isCopied = copiedId === `global-list-${idx}`;

                return (
                  <div
                    key={`g-list-${idx}`}
                    className="p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-[#0E1523] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          torrent.provider === 'YTS'
                            ? 'bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30'
                            : torrent.provider === 'ThePirateBay'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                              : torrent.provider === 'TorrentsCSV'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30'
                                : torrent.provider === '1337x'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-[#00DF81] dark:border-emerald-500/30'
                        }`}>
                          {torrent.provider}
                        </span>

                        <span className={`text-xs font-mono font-bold ${isOversized ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {torrent.size}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-[#00DF81]">
                            <ArrowUp className="w-3 h-3" /> {torrent.seeds || 0}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
                            <ArrowDown className="w-3 h-3" /> {torrent.leeches || 0}
                          </span>
                        </div>

                        {isOversized && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            &gt; 4.5 GB Limit
                          </span>
                        )}
                      </div>

                      <h4 
                        className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 leading-snug hover:text-emerald-600 dark:hover:text-[#00DF81] transition-colors"
                        title={torrent.title}
                      >
                        {torrent.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                      {isAddingThis ? (
                        <button disabled className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-[#00DF81] border border-emerald-500/30 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Adding...</span>
                        </button>
                      ) : isQueued ? (
                        <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>In Queue</span>
                        </span>
                      ) : isDownloading ? (
                        <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-[#00DF81] border border-emerald-500/30 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00DF81]" />
                          <span>In Cloud</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddMagnetClick(torrent, torrent.title)}
                          disabled={isOversized}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isOversized
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                              : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-sm active:scale-95'
                          }`}
                          title={isOversized ? 'Exceeds 4.5 GB Cloud Limit' : 'Add to Cloud'}
                        >
                          <CloudDownload className="w-3.5 h-3.5 shrink-0" />
                          <span>Add to Cloud</span>
                        </button>
                      )}

                      {torrent.magnet && (
                        <a
                          href={ensureMagnetUri(torrent.magnet, torrent.title)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onShowToast?.('Opening torrent app...', 'info');
                          }}
                          className="p-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition-all hover:scale-105 active:scale-95"
                          title="Open in Torrent App (Soft link)"
                        >
                          <Magnet className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleCopy(torrent.magnet, `global-list-${idx}`)}
                        className="p-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#090F1C] dark:hover:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-[#1E293B] transition-colors"
                        title="Copy magnet link"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 1TAMILMV VIEWS (TOP RELEASES / ALL RELEASES) */}
      {viewMode !== 'global' && (
        <>
          {/* Active Search Query Filter Pill */}
          {searchQuery && searchQuery.trim() && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 dark:text-slate-400">Filtering 1TamilMV:</span>
                <span className="font-bold text-emerald-600 dark:text-[#00DF81] bg-emerald-50 dark:bg-[#00DF81]/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-[#00DF81]/20">
                  "{searchQuery}"
                </span>
                <span className="text-slate-500">
                  ({displayedMovies.length} {displayedMovies.length === 1 ? 'match' : 'matches'})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('global');
                    executeGlobalSearch(searchQuery);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Search in Global Torrents</span>
                </button>
                {onSearchChange && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white underline ml-2"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mirror Error Notice */}
          {error && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-600 dark:text-amber-300">Mirror Access Notice</h4>
                <p className="text-xs text-amber-700 dark:text-amber-200/80 leading-relaxed">
                  {error}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Tip: Click <strong>"Rediscover"</strong> above or switch to the <strong>"Global Search"</strong> tab to search worldwide indexers directly.
                </p>
              </div>
            </div>
          )}

          {/* Loading / Scraping Skeleton (NO PHOTOS) */}
          {(loading || rediscovering) && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#111927] border border-emerald-500/20 rounded-2xl p-6 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2.5">
                  <Loader2 className="w-5 h-5 animate-spin text-[#00DF81]" />
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    Connecting to 1TamilMV mirror & extracting latest releases...
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Parsing forum topics, language streams, audio tracks, and multi-resolution magnets...
                </p>
              </div>

              <div className={layoutMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-4 space-y-2.5 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800/60 rounded w-1/3" />
                    <div className="h-5 bg-slate-200 dark:bg-slate-800/60 rounded w-3/4" />
                    <div className="h-8 bg-slate-100 dark:bg-slate-800/40 rounded-lg w-full mt-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && displayedMovies.length === 0 && (
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <Film className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {searchQuery && searchQuery.trim() ? `No 1TamilMV releases matching "${searchQuery}"` : 'No Releases Found'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {searchQuery && searchQuery.trim() 
                    ? `We couldn't find "${searchQuery}" on the 1TamilMV mirror. Try searching on Global Public Trackers!`
                    : 'Searching for active mirror and top releases...'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {searchQuery && searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('global');
                      executeGlobalSearch(searchQuery);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00DF81] text-[#071911] shadow-lg shadow-emerald-500/20 hover:bg-[#00c572] transition-all active:scale-95"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Search Global Trackers (YTS, PirateBay)</span>
                  </button>
                )}

                {searchQuery && searchQuery.trim() && viewMode === 'top' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                  >
                    <Film className="w-4 h-4" />
                    <span>Check All Releases</span>
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

          {/* 1TAMILMV - GRID VIEW (NO PHOTOS - CLEAN COMPACT DESIGN) */}
          {!loading && layoutMode === 'grid' && displayedMovies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                    className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 group"
                  >
                    <div>
                      {/* Top Badges Row (NO PHOTO) */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-[#00DF81] dark:border-emerald-500/30">
                            {movie.quality || 'HD'}
                          </span>
                          {movie.isTopRelease && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-500 fill-orange-500/20" />
                              TOP
                            </span>
                          )}
                          {movie.year && (
                            <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                              {movie.year}
                            </span>
                          )}
                        </div>

                        {magnets.length > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            <span>{magnets.length} {magnets.length === 1 ? 'Link' : 'Links'}</span>
                          </span>
                        )}
                      </div>

                      {/* Clean Movie Title - Primary Visual Focus */}
                      <h3
                        className="text-base sm:text-lg font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-emerald-600 dark:group-hover:text-[#00DF81] transition-colors mb-2"
                        title={movie.title}
                      >
                        {movie.title}
                      </h3>

                      {/* Resolutions Summary Pills */}
                      {uniqueQualities.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Resolutions:
                          </span>
                          {uniqueQualities.map(q => (
                            <span
                              key={q}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {q}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Multi-Language / Audio Filter Tabs */}
                      {hasMultipleLangs && (
                        <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800/60 mb-2.5">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-0.5">
                            Audio:
                          </span>
                          <button
                            onClick={() => setSelectedLangMap(prev => ({ ...prev, [movie.id]: 'ALL' }))}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                              activeLang === 'ALL'
                                ? 'bg-[#00DF81] text-[#071911] shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
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
                                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {lang} {langCount > 0 ? `(${langCount})` : ''}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {!hasMultipleLangs && movie.languages?.length === 1 && (
                        <div className="mb-2.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                            {movie.languages[0]} Audio
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Direct Available Links & Sizes List */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CloudDownload className="w-3.5 h-3.5" />
                          Available Links
                        </span>
                        {visibleMagnets.length > 0 && (
                          <span className="text-[10px] font-mono text-slate-400 font-normal">
                            {visibleMagnets.length} {visibleMagnets.length === 1 ? 'option' : 'options'}
                          </span>
                        )}
                      </div>

                      {visibleMagnets.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {visibleMagnets.map((link, lIdx) => {
                            const isOversized = link.size && isOversizedForSeedr(link.size);
                            const isCopied = copiedId === `${movie.id}-${lIdx}`;
                            const magnetTitle = link.title || movie.title;
                            const displaySize = link.size || 'Direct';

                            const linkHash = extractMagnetHash(link.magnet);
                            const isAddingThis = addingMagnet === link.magnet;
                            const isQueued = queuedHashSet.has(linkHash);
                            const isDownloading = activeHashSet.has(linkHash);

                            return (
                              <div
                                key={lIdx}
                                className={`p-2.5 rounded-xl border transition-all space-y-1.5 ${
                                  isQueued 
                                    ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/10' 
                                    : isDownloading
                                      ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/10'
                                      : 'bg-slate-50 dark:bg-[#090F1C] border-slate-200 dark:border-[#1E293B] hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider shrink-0 ${
                                      link.quality === '4K' || link.quality === '2160P'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-[#00DF81] dark:border-emerald-500/30'
                                    }`}>
                                      {link.quality || 'HD'}
                                    </span>

                                    <span className={`text-xs font-bold font-mono shrink-0 ${isOversized ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                      {displaySize}
                                    </span>

                                    {link.provider && (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                        link.provider === 'YTS'
                                          ? 'bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30'
                                          : link.provider === 'ThePirateBay'
                                            ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                                            : link.provider === '1337x'
                                              ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                                              : 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30'
                                      }`}>
                                        {link.provider}
                                      </span>
                                    )}

                                    {hasMultipleLangs && activeLang === 'ALL' && link.language && (
                                      <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/15 px-1.5 py-0.2 rounded border border-sky-300 dark:border-sky-500/30 shrink-0">
                                        {link.language}
                                      </span>
                                    )}
                                  </div>

                                  {isOversized && (
                                    <span className="text-[9px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-500/20 shrink-0">
                                      &gt; 4.5 GB Limit
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
                                  <div className="min-w-0 flex-1">
                                    {isQueued ? (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                        <Clock className="w-3 h-3 shrink-0" />
                                        Scheduled in Queue
                                      </span>
                                    ) : isDownloading ? (
                                      <span className="text-[10px] text-emerald-600 dark:text-[#00DF81] font-semibold flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 shrink-0" />
                                        In Cloud
                                      </span>
                                    ) : link.title && link.title !== movie.title ? (
                                      <p className="text-[10px] text-slate-500 truncate" title={link.title}>
                                        {link.title}
                                      </p>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">
                                        {isOversized ? 'Exceeds 4.5 GB Limit' : 'Direct Cloud Download'}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isAddingThis ? (
                                      <button disabled className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-[#00DF81] border border-emerald-500/30">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Adding...</span>
                                      </button>
                                    ) : isQueued ? (
                                      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                        <Clock className="w-3 h-3 shrink-0" />
                                        <span>In Queue</span>
                                      </span>
                                    ) : isDownloading ? (
                                      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-[#00DF81] border border-emerald-500/30">
                                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                                        <span>In Cloud</span>
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => handleAddMagnetClick(link, magnetTitle)}
                                        disabled={isOversized}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                          isOversized
                                            ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700'
                                            : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-md shadow-emerald-500/20 active:scale-95'
                                        }`}
                                        title={isOversized ? 'Exceeds 4.5 GB Cloud limit' : 'Add to Cloud (Convert to direct download)'}
                                      >
                                        <CloudDownload className="w-3.5 h-3.5 shrink-0" />
                                        <span>Add to Cloud</span>
                                      </button>
                                    )}

                                    {link.magnet && (
                                      <a
                                        href={ensureMagnetUri(link.magnet, link.title || movie.title)}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onShowToast?.('Opening torrent app...', 'info');
                                        }}
                                        className="p-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition-all hover:scale-105 active:scale-95"
                                        title="Open in Torrent App (Soft link)"
                                      >
                                        <Magnet className="w-3.5 h-3.5" />
                                      </a>
                                    )}

                                    <button
                                      onClick={() => handleCopy(link.magnet, `${movie.id}-${lIdx}`)}
                                      className="p-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
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
                      ) : movie.linksChecked && movie.noLinksFound ? (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-center space-y-1.5">
                          <div className="flex items-center justify-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-300">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Download Links Pending</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Upcoming release thread. Download links have not been published yet.
                          </p>
                          <div className="flex items-center justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setViewMode('global');
                                executeGlobalSearch(movie.title);
                              }}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-[#00DF81] text-[#071911] hover:bg-[#05D686] transition-all shadow-sm"
                            >
                              Search Global Trackers
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFetchMovieLinks(movie)}
                              disabled={isFetchingThis}
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
                            >
                              Retry Check
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleFetchMovieLinks(movie)}
                          disabled={isFetchingThis}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 transition-all disabled:opacity-50 active:scale-[0.99]"
                        >
                          {isFetchingThis ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                              <span>Fetching links & sizes...</span>
                            </>
                          ) : (
                            <>
                              <CloudDownload className="w-3.5 h-3.5 text-sky-500" />
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

          {/* 1TAMILMV - LIST VIEW (NO PHOTOS - HIGH-DENSITY HORIZONTAL ROWS) */}
          {!loading && layoutMode === 'list' && displayedMovies.length > 0 && (
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl divide-y divide-slate-100 dark:divide-[#1E293B] shadow-sm overflow-hidden">
              {displayedMovies.map((movie) => {
                const magnets = (movie.magnets && movie.magnets.length > 0)
                  ? movie.magnets
                  : (movie.magnet ? [{ magnet: movie.magnet, quality: movie.quality, size: movie.size, title: movie.title, language: movie.languages?.[0] || '' }] : []);

                const isFetchingThis = loadingLinksMap[movie.id];
                const uniqueQualities = Array.from(new Set(magnets.map(m => m.quality).filter(Boolean)));

                return (
                  <div
                    key={`list-${movie.id}`}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-[#0E1523] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Left Info: Movie Title, Badges, Resolutions, Languages */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-[#00DF81] dark:border-emerald-500/30">
                          {movie.quality || 'HD'}
                        </span>
                        {movie.isTopRelease && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-500 fill-orange-500/20" />
                            TOP
                          </span>
                        )}
                        {movie.year && (
                          <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                            {movie.year}
                          </span>
                        )}
                        {magnets.length > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {magnets.length} {magnets.length === 1 ? 'Link' : 'Links'}
                          </span>
                        )}
                      </div>

                      <h3
                        className="text-base font-bold text-slate-900 dark:text-white leading-snug hover:text-emerald-600 dark:hover:text-[#00DF81] transition-colors"
                        title={movie.title}
                      >
                        {movie.title}
                      </h3>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {uniqueQualities.length > 0 && (
                          <div className="flex items-center gap-1">
                            {uniqueQualities.map(q => (
                              <span key={q} className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {q}
                              </span>
                            ))}
                          </div>
                        )}
                        {movie.languages?.length > 0 && (
                          <div className="flex items-center gap-1">
                            {movie.languages.map(lang => (
                              <span key={lang} className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25">
                                {lang}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Download Links / Streams Strip */}
                    <div className="shrink-0 flex items-center gap-2 flex-wrap lg:max-w-md justify-end">
                      {magnets.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {magnets.slice(0, 3).map((link, lIdx) => {
                            const isOversized = link.size && isOversizedForSeedr(link.size);
                            const linkHash = extractMagnetHash(link.magnet);
                            const isAddingThis = addingMagnet === link.magnet;
                            const isQueued = queuedHashSet.has(linkHash);
                            const isDownloading = activeHashSet.has(linkHash);
                            const isCopied = copiedId === `list-${movie.id}-${lIdx}`;

                            return (
                              <div
                                key={lIdx}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
                                  isQueued
                                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500/30'
                                    : isDownloading
                                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/30'
                                      : 'bg-slate-50 dark:bg-[#0A0F1D] border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <span className="font-bold text-[10px] text-emerald-600 dark:text-[#00DF81]">
                                  {link.quality || 'HD'}
                                </span>
                                {link.provider && (
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    link.provider === 'YTS'
                                      ? 'bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30'
                                      : link.provider === 'ThePirateBay'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                                        : link.provider === '1337x'
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                                          : 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30'
                                  }`}>
                                    {link.provider}
                                  </span>
                                )}
                                <span className={`font-mono text-[11px] ${isOversized ? 'text-rose-500 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                  {link.size || ''}
                                </span>

                                {isAddingThis ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00DF81]" />
                                ) : isQueued ? (
                                  <span className="text-[10px] text-amber-500 font-semibold">Queued</span>
                                ) : isDownloading ? (
                                  <span className="text-[10px] text-[#00DF81] font-semibold">In Cloud</span>
                                ) : (
                                  <button
                                    onClick={() => handleAddMagnetClick(link, link.title || movie.title)}
                                    disabled={isOversized}
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                      isOversized
                                        ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400'
                                        : 'bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-sm'
                                    }`}
                                    title={isOversized ? 'Exceeds 4.5 GB limit' : 'Add to Cloud'}
                                  >
                                    Add to Cloud
                                  </button>
                                )}

                                {link.magnet && (
                                  <a
                                    href={ensureMagnetUri(link.magnet, link.title || movie.title)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onShowToast?.('Opening torrent app...', 'info');
                                    }}
                                    className="text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 p-0.5 transition-colors"
                                    title="Open in Torrent App (Soft link)"
                                  >
                                    <Magnet className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                <button
                                  onClick={() => handleCopy(link.magnet, `list-${movie.id}-${lIdx}`)}
                                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
                                  title="Copy magnet"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-[#00DF81]" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            );
                          })}

                          {magnets.length > 3 && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              +{magnets.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleFetchMovieLinks(movie)}
                          disabled={isFetchingThis}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 hover:bg-sky-100 transition-all disabled:opacity-50"
                        >
                          {isFetchingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
                          <span>{isFetchingThis ? 'Fetching...' : 'Fetch Links'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Show All Latest Movies Button when in Top Releases */}
          {!loading && viewMode === 'top' && allMovies.length > topReleases.length && (
            <div className="pt-2 text-center">
              <button
                onClick={() => setViewMode('all')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-white dark:bg-[#111927] hover:bg-slate-50 dark:hover:bg-[#162134] text-emerald-600 dark:text-[#00DF81] border border-emerald-500/30 hover:border-emerald-500/60 shadow-sm transition-all active:scale-95 group"
              >
                <Film className="w-4 h-4 text-[#00DF81] group-hover:scale-110 transition-transform" />
                <span>Show All Latest Releases ({allMovies.length})</span>
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
