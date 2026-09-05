import React, { useState, useEffect, useMemo } from 'react';
import { 
  Film, 
  Search, 
  RefreshCw, 
  Download, 
  ListOrdered, 
  Copy, 
  Check, 
  ExternalLink, 
  Globe, 
  Settings2, 
  AlertCircle, 
  ShieldAlert, 
  Sparkles, 
  Play, 
  X,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import api from '../api/client';
import { isOversizedForSeedr } from '../utils/magnet';

export default function MirrorMoviesView({
  onAddMagnet,
  onAddToQueue,
  onShowToast
}) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rediscovering, setRediscovering] = useState(false);
  const [error, setError] = useState(null);
  const [mirrorStatus, setMirrorStatus] = useState(null);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuality, setSelectedQuality] = useState('ALL');
  const [sortBy, setSortBy] = useState('default');

  // Config / Override drawer
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [customKeyword, setCustomKeyword] = useState('');
  const [customEngine, setCustomEngine] = useState('bing');
  const [manualDomain, setManualDomain] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Detail Modal for multi-magnet or pending detail
  const [detailModal, setDetailModal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Copied state tracker
  const [copiedId, setCopiedId] = useState(null);

  const fetchMovies = async (refresh = false) => {
    try {
      if (refresh) setRediscovering(true);
      else setLoading(true);
      setError(null);

      const res = await api.get(`/mirror/movies${refresh ? '?refresh=true' : ''}`);
      if (res.data?.success) {
        setMovies(res.data.movies || []);
        setMirrorStatus({
          domain: res.data.domain,
          keyword: res.data.keyword,
          engine: res.data.searchEngine,
          lastUpdated: res.data.lastUpdated,
          cached: res.data.cachedDomain
        });
        if (res.data.keyword) {
          setCustomKeyword(res.data.keyword);
        }
      } else {
        setError(res.data?.error || 'Failed to load movie listings');
        if (res.data?.domain) {
          setMirrorStatus(prev => ({ ...(prev || {}), domain: res.data.domain }));
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error fetching movies';
      setError(msg);
      // Try to read status
      if (err.response?.data?.status) {
        const st = err.response.data.status;
        setMirrorStatus({
          domain: st.activeDomain,
          keyword: st.configuredKeyword,
          engine: st.searchEngine
        });
        if (st.configuredKeyword) setCustomKeyword(st.configuredKeyword);
      }
    } finally {
      setLoading(false);
      setRediscovering(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      setSavingConfig(true);
      const res = await api.post('/mirror/config', {
        keyword: customKeyword,
        searchEngine: customEngine,
        fallbackDomain: manualDomain
      });

      if (res.data?.success) {
        onShowToast?.('Configuration saved! Discovering active domain...', 'success');
        setIsConfigOpen(false);
        fetchMovies(true);
      }
    } catch (err) {
      onShowToast?.(err.response?.data?.error || 'Failed to update config', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleManualOverride = async (e) => {
    if (e) e.preventDefault();
    if (!manualDomain) return;
    try {
      setSavingConfig(true);
      const res = await api.post('/mirror/override', { domain: manualDomain });
      if (res.data?.success) {
        onShowToast?.(`Mirror domain set to ${res.data.data.domain}`, 'success');
        setIsConfigOpen(false);
        fetchMovies(false);
      }
    } catch (err) {
      onShowToast?.(err.response?.data?.error || 'Failed to set domain', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCopy = (magnet, id) => {
    if (!magnet) return;
    navigator.clipboard.writeText(magnet);
    setCopiedId(id);
    onShowToast?.('Magnet link copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenDetail = async (movie) => {
    if (!movie.detailUrl) return;
    try {
      setDetailLoading(true);
      setDetailModal({ ...movie, magnets: [] });
      const res = await api.get(`/mirror/detail?url=${encodeURIComponent(movie.detailUrl)}`);
      if (res.data?.success && res.data.details) {
        setDetailModal(res.data.details);
      }
    } catch (err) {
      onShowToast?.('Failed to load movie details: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  // Client-side filtering & sorting
  const filteredMovies = useMemo(() => {
    return movies
      .filter(movie => {
        const matchesSearch = !searchTerm || movie.title?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesQuality = selectedQuality === 'ALL' || movie.quality?.toUpperCase().includes(selectedQuality);
        return matchesSearch && matchesQuality;
      })
      .sort((a, b) => {
        if (sortBy === 'seeds') return (b.seeds || 0) - (a.seeds || 0);
        return 0;
      });
  }, [movies, searchTerm, selectedQuality, sortBy]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner & Control Bar */}
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Film className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Top Releases • 1TamilMV
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                PROXIED TOP RELEASES
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Curated top movie & series releases of the week from the active mirror, with one-click Seedr cloud downloading and streaming.
            </p>
          </div>

          {/* Mirror Status Pill & Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            {mirrorStatus?.domain ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-emerald-400 font-semibold truncate max-w-[180px]">
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

            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00DF81]/10 hover:bg-[#00DF81]/20 text-[#00DF81] border border-[#00DF81]/30 transition-all"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Keyword & Config</span>
            </button>
          </div>
        </div>

        {/* Expandable Configuration Drawer */}
        {isConfigOpen && (
          <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                Search Discovery Keyword
              </h3>
              <p className="text-[11px] text-slate-400">
                Enter the name or keyword of the site. When saved, the server searches Google/Bing and follows the first organic link.
              </p>
              <form onSubmit={handleSaveConfig} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                    placeholder="e.g. 1337x, tamilmv, piratebay"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-slate-400">Engine:</label>
                  <select
                    value={customEngine}
                    onChange={(e) => setCustomEngine(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="bing">Bing (Fastest & Resilient)</option>
                    <option value="google">Google</option>
                  </select>
                  <button
                    type="submit"
                    disabled={savingConfig || !customKeyword.trim()}
                    className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 disabled:opacity-50 transition-colors"
                  >
                    {savingConfig ? 'Saving...' : 'Save & Discover'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                Manual Domain Override / Fallback
              </h3>
              <p className="text-[11px] text-slate-400">
                If search is throttled or the mirror requires a specific URL, you can enter it directly:
              </p>
              <form onSubmit={handleManualOverride} className="flex gap-2 items-center">
                <input
                  type="url"
                  value={manualDomain}
                  onChange={(e) => setManualDomain(e.target.value)}
                  placeholder="https://your-mirror.to"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={savingConfig || !manualDomain.trim()}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-600 text-slate-950 disabled:opacity-50 transition-colors shrink-0"
                >
                  Set Domain
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111927] p-3 rounded-xl border border-[#1E293B]">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter discovered movies by title..."
            className="w-full bg-[#0A0F1D] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            Quality:
          </span>
          {['ALL', '2160P', '1080P', '720P'].map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuality(q)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                selectedQuality === q
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {q}
            </button>
          ))}

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none shrink-0 ml-1"
          >
            <option value="default">Default Order</option>
            <option value="seeds">Most Seeders</option>
          </select>
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
              Tip: Click <strong>"Keyword & Config"</strong> above to adjust the search keyword or specify a direct fallback domain.
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#111927] border border-[#1E293B] rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="w-full aspect-[16/10] bg-slate-800 rounded-xl" />
              <div className="h-4 bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
              <div className="pt-2 flex gap-2">
                <div className="h-8 bg-slate-800 rounded-lg flex-1" />
                <div className="h-8 bg-slate-800 rounded-lg w-10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty / Unconfigured State */}
      {!loading && movies.length === 0 && (
        <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Film className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">No Movies Found Yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {mirrorStatus?.keyword
                ? `No magnet links could be extracted from "${mirrorStatus.domain}". The domain might have changed or bot protection is active.`
                : 'No search keyword has been set in configuration yet. Set your keyword to start discovering mirrors!'}
            </p>
          </div>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Settings2 className="w-4 h-4" />
            <span>Configure Search Keyword</span>
          </button>
        </div>
      )}

      {/* Movie Cards Grid */}
      {!loading && filteredMovies.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMovies.map((movie) => {
            const isOversized = movie.size && isOversizedForSeedr(movie.size);
            const isCopied = copiedId === movie.id;

            return (
              <div
                key={movie.id}
                className="bg-[#111927] border border-[#1E293B] hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 group"
              >
                {/* Poster / Thumbnail or Fallback Header */}
                <div className="relative aspect-[16/10] bg-slate-900 rounded-xl overflow-hidden mb-3 border border-slate-800">
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : null}

                  {/* Fallback Icon if image missing */}
                  <div className="absolute inset-0 flex items-center justify-center text-slate-700 pointer-events-none -z-0">
                    <Film className="w-10 h-10 opacity-30" />
                  </div>

                  {/* Top Quality Badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
                      {movie.quality}
                    </span>
                  </div>

                  {/* Top Size Badge */}
                  {movie.size && (
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md border ${
                        isOversized
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/30'
                          : 'bg-black/70 text-slate-300 border-slate-700'
                      }`}>
                        {movie.size}
                      </span>
                    </div>
                  )}

                  {/* Seeds Overlay if present */}
                  {movie.seeds > 0 && (
                    <div className="absolute bottom-2 left-2">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-black/70 backdrop-blur-md text-emerald-300">
                        ↑ {movie.seeds} seeds
                      </span>
                    </div>
                  )}
                </div>

                {/* Movie Title & Info */}
                <div className="space-y-1.5 flex-1 mb-3">
                  <h3
                    className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors"
                    title={movie.title}
                  >
                    {movie.title}
                  </h3>
                  {isOversized && (
                    <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Exceeds Seedr 4.5 GB limit (use Queue)</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  {movie.magnet ? (
                    <div className="flex items-center gap-1.5">
                      {/* Add directly to Seedr */}
                      <button
                        onClick={() => onAddMagnet(movie.magnet, movie.title, movie.size)}
                        disabled={isOversized}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          isOversized
                            ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-800'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20'
                        }`}
                        title={isOversized ? 'File too large for direct download' : 'Direct Cloud Download to Seedr'}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Seedr</span>
                      </button>

                      {/* Add to Queue */}
                      <button
                        onClick={() => onAddToQueue(movie.magnet, movie.title, movie.size)}
                        className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-colors"
                        title="Add to Upcoming Queue"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </button>

                      {/* Copy Magnet Link */}
                      <button
                        onClick={() => handleCopy(movie.magnet, movie.id)}
                        className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Copy Magnet Link"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ) : (
                    /* Detail Page Link button */
                    <button
                      onClick={() => handleOpenDetail(movie)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-colors"
                    >
                      <span>Fetch Magnets</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal if movie page has multi-magnets */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111927] border border-[#1E293B] rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setDetailModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white pr-8">
              {detailModal.title || 'Movie Downloads'}
            </h3>

            {detailLoading ? (
              <div className="py-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Loading magnet links from mirror...</p>
              </div>
            ) : detailModal.magnets && detailModal.magnets.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {detailModal.magnets.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {m.title || m.label || `Magnet Link ${idx + 1}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          onAddMagnet(m.magnet, m.title || detailModal.title);
                          setDetailModal(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-600"
                      >
                        Seedr
                      </button>
                      <button
                        onClick={() => {
                          onAddToQueue(m.magnet, m.title || detailModal.title);
                          setDetailModal(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30"
                      >
                        Queue
                      </button>
                      <button
                        onClick={() => handleCopy(m.magnet, `modal-${idx}`)}
                        className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                No direct magnet links found on this detail page.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
