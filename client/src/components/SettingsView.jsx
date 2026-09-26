import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Search, 
  Globe, 
  RefreshCw, 
  Check, 
  ExternalLink,
  HardDrive,
  Save,
  Moon,
  Sun,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tv,
  Wifi,
  Radio,
  Play
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StorageCard from './StorageCard';
import { formatBytes } from '../utils/magnet';
import { 
  getSavedAndroidTvIp, 
  setSavedAndroidTvIp, 
  getSavedVlcTarget, 
  setSavedVlcTarget, 
  testAndroidTvConnection 
} from '../utils/vlc';
import { VlcIcon } from './VLCStreamModal';

export default function SettingsView({ 
  storage = { spaceUsed: 0, spaceMax: 0 }, 
  onShowToast,
  isDarkMode,
  onToggleTheme 
}) {
  const [keyword, setKeyword] = useState('1tamilmv');
  const [searchEngine, setSearchEngine] = useState('bing');
  const [fallbackDomain, setFallbackDomain] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rediscovering, setRediscovering] = useState(false);

  const [tvIp, setTvIp] = useState(() => getSavedAndroidTvIp());
  const [vlcTarget, setVlcTarget] = useState(() => getSavedVlcTarget());
  const [testingTv, setTestingTv] = useState(false);
  const [tvTestResult, setTvTestResult] = useState(null);

  const handleSaveTvSettings = (newIp, newTarget) => {
    const ipToSave = newIp !== undefined ? newIp : tvIp;
    const targetToSave = newTarget !== undefined ? newTarget : vlcTarget;
    setSavedAndroidTvIp(ipToSave);
    setSavedVlcTarget(targetToSave);
    onShowToast?.('Android TV VLC preferences saved!', 'success');
  };

  const handleTestTv = async () => {
    if (!tvIp.trim()) {
      setTvTestResult({ success: false, message: 'Please enter your Android TV IP address' });
      return;
    }
    setTestingTv(true);
    setTvTestResult(null);
    try {
      const res = await testAndroidTvConnection(tvIp.trim());
      setTvTestResult(res);
      if (res.success) {
        onShowToast?.('Connected to Android TV!', 'success');
      } else {
        onShowToast?.(res.message || 'Android TV did not respond', 'warning');
      }
    } catch (e) {
      setTvTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setTestingTv(false);
    }
  };

  const used = storage.spaceUsed || 0;
  const max = storage.spaceMax || (4.5 * 1024 * 1024 * 1024);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/mirror/status');
      if (res.data?.success && res.data.status) {
        const s = res.data.status;
        setStatus(s);
        if (s.configuredKeyword) setKeyword(s.configuredKeyword);
        if (s.searchEngine) setSearchEngine(s.searchEngine);
        if (s.fallbackDomain) setFallbackDomain(s.fallbackDomain);
        if (s.proxyUrl !== undefined) setProxyUrl(s.proxyUrl || '');
      }
    } catch (err) {
      console.error('Failed to load mirror settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!keyword.trim()) {
      onShowToast?.('Search keyword cannot be empty', 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await api.post('/mirror/config', {
        keyword: keyword.trim(),
        searchEngine,
        fallbackDomain: fallbackDomain.trim(),
        proxyUrl: proxyUrl.trim()
      });

      if (res.data?.success) {
        onShowToast?.('Settings saved! Mirror updated.', 'success');
        if (res.data.status) setStatus(res.data.status);
      } else {
        onShowToast?.(res.data?.error || 'Failed to update settings', 'error');
      }
    } catch (err) {
      onShowToast?.(err.response?.data?.error || err.message || 'Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRediscover = async () => {
    try {
      setRediscovering(true);
      const res = await api.post('/mirror/rediscover');
      if (res.data?.success) {
        onShowToast?.(`Rediscovered active mirror: ${res.data.domain || 'Domain updated'}`, 'success');
        await fetchSettings();
      } else {
        onShowToast?.(res.data?.error || 'Failed to rediscover mirror', 'error');
      }
    } catch (err) {
      onShowToast?.(err.response?.data?.error || 'Error rediscovering mirror', 'error');
    } finally {
      setRediscovering(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="pb-3 border-b border-slate-200 dark:border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-[#00DF81] rounded-xl border border-emerald-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Settings & Account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage your Cloud storage quota, search preferences, and mirror scraper configuration
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Cloud Storage Details */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[#00DF81]" />
          <span>Cloud Storage Details</span>
        </h2>

        <StorageCard storage={storage} />

        <div className="bg-white dark:bg-[#111927] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#1E293B] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#00DF81]/10 text-[#00DF81] rounded-xl border border-[#00DF81]/20">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Free Tier Account</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total capacity: {formatBytes(max)}</p>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#00DF81] font-mono">
              {formatBytes(used)} Used
            </span>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-[#1E293B] flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Want more than 4.5 GB cloud storage?</span>
            <a
              href="https://www.seedr.cc/premium"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-[#00DF81] hover:underline"
            >
              <span>Upgrade on Seedr.cc</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* SECTION 2: Active Mirror Status & Configuration */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#00DF81]" />
          <span>Movie Mirror & Search Scraper</span>
        </h2>

        {/* Current Active Mirror Banner */}
        <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#00DF81]" />
              Current Active Domain
            </span>
            <button
              onClick={handleRediscover}
              disabled={rediscovering || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50"
              title="Force query search engine now to find newest mirror"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rediscovering ? 'animate-spin text-[#00DF81]' : ''}`} />
              <span>Rediscover Mirror</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#111927] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00DF81] animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white truncate">
                  {status?.activeDomain || 'https://www.1tamilmv.meme'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {status?.engineUsed ? `Discovered via ${status.engineUsed}` : 'Automated dynamic resolution'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/15 text-[#00DF81] border border-emerald-500/30 shrink-0">
              VERIFIED LIVE
            </span>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4 text-[#00DF81]" />
                Search Keyword for Mirror Discovery
              </span>
              <span className="text-[10px] font-normal text-slate-500">Default: 1tamilmv</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. 1tamilmv"
              className="w-full bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00DF81] focus:ring-1 focus:ring-[#00DF81]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#00DF81]" />
              Discovery Search Engine
            </label>
            <select
              value={searchEngine}
              onChange={(e) => setSearchEngine(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00DF81] focus:ring-1 focus:ring-[#00DF81]"
            >
              <option value="bing">Bing (Fastest, High Success Rate)</option>
              <option value="google">Google</option>
              <option value="duckduckgo">DuckDuckGo (HTML / Fallback)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#00DF81]" />
                Custom Fallback Domain (Optional)
              </span>
              <span className="text-[10px] font-normal text-slate-500">Leave blank for auto-discovery</span>
            </label>
            <input
              type="text"
              value={fallbackDomain}
              onChange={(e) => setFallbackDomain(e.target.value)}
              placeholder="e.g. https://www.1tamilmv.meme"
              className="w-full bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00DF81] focus:ring-1 focus:ring-[#00DF81]"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00DF81] hover:bg-[#00DF81]/90 text-[#071911] font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: Android TV & VLC Player Integration */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Tv className="w-4 h-4 text-orange-500" />
          <span>Android TV & VLC Player Integration</span>
        </h2>

        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl border border-orange-500/20 shrink-0">
                <VlcIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  VLC Remote Streaming to Android TV
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure your Android TV IP to play videos directly on your TV when clicking "Open in VLC"
                </p>
              </div>
            </div>

            <Link
              to="/tv"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-xs font-bold transition-all self-start sm:self-auto shrink-0"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Open TV Companion Mode</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* TV IP Input */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-orange-500" />
                  Android TV IP Address
                </span>
                <span className="text-[10px] text-slate-400 font-normal">e.g. 192.168.1.50</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tvIp}
                  onChange={(e) => {
                    setTvIp(e.target.value);
                    setTvTestResult(null);
                  }}
                  placeholder="192.168.1.xxx"
                  className="flex-1 bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={handleTestTv}
                  disabled={testingTv || !tvIp.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E293B] dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#2E3D52] transition-colors disabled:opacity-50 shrink-0"
                >
                  {testingTv ? 'Testing...' : 'Test IP'}
                </button>
              </div>
            </div>

            {/* Default VLC Target */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Play className="w-4 h-4 text-orange-500" />
                Default "Open in VLC" Action
              </label>
              <select
                value={vlcTarget}
                onChange={(e) => {
                  setVlcTarget(e.target.value);
                  handleSaveTvSettings(tvIp, e.target.value);
                }}
                className="w-full bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
              >
                <option value="device">Launch on This Device (Desktop / Phone VLC)</option>
                <option value="android-tv">Launch on Android TV VLC (Remote Stream)</option>
                <option value="both">Launch on Both (This Device + Android TV)</option>
              </select>
            </div>
          </div>

          {/* Test Status Feedback */}
          {tvTestResult && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
              tvTestResult.success 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-[#00DF81] border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
            }`}>
              {tvTestResult.success ? <Check className="w-4 h-4 shrink-0 text-[#00DF81]" /> : <Radio className="w-4 h-4 shrink-0 text-amber-400" />}
              <span>{tvTestResult.message}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveTvSettings(tvIp, vlcTarget)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-orange-500/20 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Android TV Preferences</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 4: Appearance Preferences */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00DF81]" />
          <span>Appearance & Preferences</span>
        </h2>

        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-sm flex items-center justify-between">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Theme Mode</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Current mode: {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </p>
          </div>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              <span>Switch to {isDarkMode ? 'Light' : 'Dark'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
