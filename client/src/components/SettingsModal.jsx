import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Search, 
  Globe, 
  RefreshCw, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  ExternalLink,
  HardDrive,
  Sliders,
  Sparkles,
  Save
} from 'lucide-react';
import api from '../api/client';

export default function SettingsModal({ isOpen, onClose, onShowToast, onConfigUpdated }) {
  const [keyword, setKeyword] = useState('1tamilmv');
  const [searchEngine, setSearchEngine] = useState('bing');
  const [fallbackDomain, setFallbackDomain] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rediscovering, setRediscovering] = useState(false);

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
      }
    } catch (err) {
      console.error('Failed to load mirror settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
        fallbackDomain: fallbackDomain.trim()
      });

      if (res.data?.success) {
        onShowToast?.('Settings updated successfully! Mirror rediscovered.', 'success');
        if (res.data.status) setStatus(res.data.status);
        onConfigUpdated?.();
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
        onConfigUpdated?.();
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-[#1E293B] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#111927]">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 text-[#00DF81] p-2.5 rounded-xl border border-emerald-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Settings
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure search keyword, mirror discovery, and download preferences
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Active Mirror Status Card */}
          <div className="bg-[#090F1C] border border-[#1E293B] rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#00DF81]" />
                Current Active Mirror
              </span>
              <button
                onClick={handleRediscover}
                disabled={rediscovering || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all disabled:opacity-50"
                title="Force query search engine now to find newest mirror"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rediscovering ? 'animate-spin text-[#00DF81]' : ''}`} />
                <span>Rediscover</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 bg-[#111927] p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00DF81] animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-mono font-bold text-white truncate">
                    {status?.activeDomain || 'https://www.1tamilmv.meme'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {status?.engineUsed ? `Discovered via ${status.engineUsed}` : 'Automated dynamic resolution'}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-[#00DF81] border border-emerald-500/30 shrink-0">
                VERIFIED LIVE
              </span>
            </div>
          </div>

          {/* Form: Configure Search Keyword & Mirror */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-200 flex items-center justify-between">
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
                className="w-full bg-[#090F1C] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00DF81] transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                The search term the scraper queries to automatically discover and bypass blocked mirror domains.
              </p>
            </div>

            {/* Search Engine Selection */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-sky-400" />
                Discovery Search Engine
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'bing', name: 'Bing (Recommended)', desc: 'Fast & reliable, no CAPTCHA' },
                  { id: 'google', name: 'Google', desc: 'Direct search index' }
                ].map((engine) => (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => setSearchEngine(engine.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      searchEngine === engine.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-sm'
                        : 'bg-[#090F1C] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold">{engine.name}</span>
                      {searchEngine === engine.id && (
                        <Check className="w-3.5 h-3.5 text-[#00DF81]" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">{engine.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fallback / Manual Override Domain */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-200 flex items-center justify-between">
                <span>Manual Override / Fallback Domain (Optional)</span>
                <span className="text-[10px] font-normal text-slate-500">Optional</span>
              </label>
              <input
                type="text"
                value={fallbackDomain}
                onChange={(e) => setFallbackDomain(e.target.value)}
                placeholder="https://www.1tamilmv.meme"
                className="w-full bg-[#090F1C] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00DF81] transition-colors font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Optionally lock the scraper to a known domain if search engine discovery is slow or blocked.
              </p>
            </div>

            {/* System Info */}
            <div className="bg-[#090F1C]/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-[#00DF81]" />
                <span>Cloud & System Guardrails</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 pl-6 list-disc">
                <li>Seedr Free capacity: <strong>4.5 GB limit</strong> (larger files automatically routed to queue).</li>
                <li>Torrent Watchdog: Stalled torrents with 0 progress are auto-deleted after <strong>2 minutes</strong>.</li>
                <li>Queue Scheduler: Downloads process in order (FIFO) as storage space is freed.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || rediscovering}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#00DF81] hover:bg-[#05D686] text-[#071911] shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 active:scale-95"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
