const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config.json');

class MirrorDiscoveryService {
  constructor() {
    this.cacheFile = path.join(__dirname, '../../data/mirror_cache.json');
    this.memoryCache = null;
    this.loadCache();
  }

  getConfig() {
    const mirrorCfg = config.mirrorDiscovery || {};
    return {
      keyword: (process.env.DISCOVERY_KEYWORD || mirrorCfg.keyword || '').trim(),
      searchEngine: (process.env.DISCOVERY_SEARCH_ENGINE || mirrorCfg.searchEngine || 'bing').toLowerCase(),
      fallbackDomain: (process.env.DISCOVERY_FALLBACK_DOMAIN || mirrorCfg.fallbackDomain || '').trim(),
      cacheTtlMinutes: parseInt(process.env.DISCOVERY_CACHE_TTL || mirrorCfg.cacheTtlMinutes || 360, 10),
      timeoutMs: parseInt(mirrorCfg.timeoutMs || 10000, 10),
      googleApiKey: process.env.GOOGLE_API_KEY || '',
      googleCseId: process.env.GOOGLE_CSE_ID || ''
    };
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        this.memoryCache = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[MirrorDiscovery] Failed to load disk cache:', e.message);
      this.memoryCache = null;
    }
  }

  saveCache(data) {
    this.memoryCache = data;
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[MirrorDiscovery] Failed to write disk cache:', e.message);
    }
  }

  isCacheValid() {
    if (!this.memoryCache || !this.memoryCache.domain) return false;
    const cfg = this.getConfig();
    if (cfg.keyword && this.memoryCache.keyword !== cfg.keyword) return false;

    const ageMs = Date.now() - new Date(this.memoryCache.discoveredAt).getTime();
    const ttlMs = (cfg.cacheTtlMinutes || 360) * 60 * 1000;
    return ageMs < ttlMs;
  }

  decodeBingUrl(url) {
    if (!url) return null;
    try {
      const match = url.match(/[?&]u=a1([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';
        return Buffer.from(b64, 'base64').toString('utf-8');
      }
    } catch (e) {
      // Return original on decode error
    }
    return url;
  }

  cleanDomain(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      return null;
    }
  }

  isExcludedDomain(urlStr) {
    if (!urlStr) return true;
    const lower = urlStr.toLowerCase();
    const excludedHosts = [
      'bing.com',
      'microsoft.com',
      'google.com',
      'google.',
      'wikipedia.org',
      'reddit.com',
      'youtube.com',
      'youtu.be',
      'twitter.com',
      'x.com',
      'facebook.com',
      'instagram.com',
      'yahoo.com',
      'quora.com',
      'github.com',
      'vpncentral.com',
      'privacysavvy.com',
      'techradar.com',
      't.me',
      'telegram.org'
    ];
    return excludedHosts.some(ex => lower.includes(ex));
  }

  async searchBing(keyword) {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const $ = cheerio.load(response.data);
    const candidateUrls = [];

    $('#b_results li.b_algo h2 a').each((_, el) => {
      const rawHref = $(el).attr('href');
      const decoded = this.decodeBingUrl(rawHref);
      if (decoded && !this.isExcludedDomain(decoded)) {
        candidateUrls.push(decoded);
      }
    });

    // Fallback selectors if b_algo wasn't matched
    if (candidateUrls.length === 0) {
      $('a').each((_, el) => {
        const rawHref = $(el).attr('href');
        const decoded = this.decodeBingUrl(rawHref);
        if (decoded && decoded.startsWith('http') && !this.isExcludedDomain(decoded)) {
          candidateUrls.push(decoded);
        }
      });
    }

    return candidateUrls;
  }

  async searchGoogle(keyword) {
    const cfg = this.getConfig();
    // 1. If official Google CSE is configured, use it
    if (cfg.googleApiKey && cfg.googleCseId) {
      const endpoint = `https://www.googleapis.com/customsearch/v1?key=${cfg.googleApiKey}&cx=${cfg.googleCseId}&q=${encodeURIComponent(keyword)}`;
      const res = await axios.get(endpoint, { timeout: 8000 });
      if (res.data?.items?.length > 0) {
        return res.data.items
          .map(item => item.link)
          .filter(link => !this.isExcludedDomain(link));
      }
    }

    // 2. Fallback: Search with Google HTML
    const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&gbv=1`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 8000
    });

    const $ = cheerio.load(response.data);
    const candidateUrls = [];
    $('a').each((_, el) => {
      let href = $(el).attr('href');
      if (href && href.startsWith('/url?q=')) {
        const clean = href.replace('/url?q=', '').split('&')[0];
        if (!this.isExcludedDomain(clean)) candidateUrls.push(clean);
      }
    });

    return candidateUrls;
  }

  async validateDomain(domainUrl) {
    try {
      const res = await axios.get(domainUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        timeout: 7000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });
      const html = typeof res.data === 'string' ? res.data.toLowerCase() : '';
      const hasContent = html.includes('tamilmv') || html.includes('forums') || html.includes('topic') || html.includes('magnet:') || html.includes('banger');
      return { 
        ok: res.status < 400 && hasContent, 
        status: res.status, 
        finalUrl: res.request?.res?.responseUrl || domainUrl 
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async discover(force = false) {
    const cfg = this.getConfig();

    if (!force && this.isCacheValid()) {
      return {
        cached: true,
        ...this.memoryCache
      };
    }

    if (!cfg.keyword) {
      if (cfg.fallbackDomain) {
        return {
          cached: false,
          domain: this.cleanDomain(cfg.fallbackDomain),
          keyword: '',
          discoveredAt: new Date().toISOString(),
          searchEngine: 'fallback',
          note: 'Using fallback domain; no keyword configured.'
        };
      }
      throw new Error('No search keyword configured. Please specify DISCOVERY_KEYWORD in .env or server/config.json');
    }

    // Direct check for known official redirector domains if keyword matches
    const kwLower = cfg.keyword.toLowerCase();
    if (kwLower.includes('tamilmv')) {
      try {
        console.log('[MirrorDiscovery] Checking official TamilMV redirector: https://www.1tamilmv.fi');
        const check = await this.validateDomain('https://www.1tamilmv.fi');
        if (check.ok && check.finalUrl) {
          const resolved = this.cleanDomain(check.finalUrl);
          if (resolved) {
            const cachePayload = {
              domain: resolved,
              fullUrl: check.finalUrl,
              keyword: cfg.keyword,
              discoveredAt: new Date().toISOString(),
              engine: 'official-redirector',
              lastTestedOk: true
            };
            this.saveCache(cachePayload);
            return { cached: false, ...cachePayload };
          }
        }
      } catch (e) {
        console.warn('[MirrorDiscovery] Redirector check failed, continuing to search:', e.message);
      }
    }

    let candidates = [];
    let usedEngine = cfg.searchEngine;

    // Search attempt 1: Primary configured engine
    try {
      if (cfg.searchEngine === 'google') {
        candidates = await this.searchGoogle(cfg.keyword);
      } else {
        candidates = await this.searchBing(cfg.keyword);
      }
    } catch (err) {
      console.warn(`[MirrorDiscovery] Search with ${cfg.searchEngine} failed:`, err.message);
    }

    // Search attempt 2: Alternate engine if candidates are empty
    if (candidates.length === 0) {
      try {
        if (cfg.searchEngine === 'google') {
          console.log('[MirrorDiscovery] Falling back to Bing search...');
          candidates = await this.searchBing(cfg.keyword);
          usedEngine = 'bing (fallback)';
        } else {
          console.log('[MirrorDiscovery] Falling back to Google search...');
          candidates = await this.searchGoogle(cfg.keyword);
          usedEngine = 'google (fallback)';
        }
      } catch (err2) {
        console.warn('[MirrorDiscovery] Alternate search also failed:', err2.message);
      }
    }

    // Process candidate URLs
    let resolvedDomain = null;
    let finalDestination = null;

    for (const cand of candidates) {
      const domain = this.cleanDomain(cand);
      if (domain) {
        console.log(`[MirrorDiscovery] Validating discovered candidate: ${domain}`);
        const check = await this.validateDomain(domain);
        if (check.ok) {
          resolvedDomain = this.cleanDomain(check.finalUrl) || domain;
          finalDestination = check.finalUrl;
          break;
        }
      }
    }

    // If search produced no reachable candidate, check fallbackDomain or existing cache
    if (!resolvedDomain) {
      if (cfg.fallbackDomain) {
        resolvedDomain = this.cleanDomain(cfg.fallbackDomain);
        usedEngine = 'static fallback';
      } else if (this.memoryCache?.domain) {
        resolvedDomain = this.memoryCache.domain;
        usedEngine = 'previous cache (offline fallback)';
      } else {
        throw new Error(`Could not discover an active domain for keyword "${cfg.keyword}". Try providing a fallback domain.`);
      }
    }

    const cachePayload = {
      domain: resolvedDomain,
      fullUrl: finalDestination || resolvedDomain,
      keyword: cfg.keyword,
      discoveredAt: new Date().toISOString(),
      engine: usedEngine,
      lastTestedOk: true
    };

    this.saveCache(cachePayload);

    return {
      cached: false,
      ...cachePayload
    };
  }

  setManualDomain(domain) {
    const clean = this.cleanDomain(domain);
    if (!clean) throw new Error('Invalid domain URL format');

    const cachePayload = {
      domain: clean,
      fullUrl: clean,
      keyword: this.memoryCache?.keyword || 'manual',
      discoveredAt: new Date().toISOString(),
      engine: 'manual-override',
      lastTestedOk: true
    };

    this.saveCache(cachePayload);
    return cachePayload;
  }

  getStatus() {
    const cfg = this.getConfig();
    return {
      configuredKeyword: cfg.keyword,
      searchEngine: cfg.searchEngine,
      fallbackDomain: cfg.fallbackDomain,
      cacheTtlMinutes: cfg.cacheTtlMinutes,
      activeDomain: this.memoryCache?.domain || null,
      discoveredAt: this.memoryCache?.discoveredAt || null,
      isCacheValid: this.isCacheValid(),
      engineUsed: this.memoryCache?.engine || null
    };
  }
}

module.exports = new MirrorDiscoveryService();
