const axios = require('axios');
const cheerio = require('cheerio');
const mirrorDiscovery = require('./mirrorDiscoveryService');
const config = require('../../config.json');

class MovieScraperService {
  constructor() {
    this.maxMovies = config.mirrorDiscovery?.maxMovies || 40;
    this.timeoutMs = config.mirrorDiscovery?.timeoutMs || 12000;
  }

  getBrowserHeaders(referer = '') {
    return {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      ...(referer ? { 'Referer': referer } : {})
    };
  }

  parseMagnetMetadata(magnetUri) {
    if (!magnetUri || typeof magnetUri !== 'string') return {};
    try {
      const result = {};
      const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/);
      if (dnMatch) {
        result.title = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
      }

      const xtMatch = magnetUri.match(/[?&]xt=urn:btih:([a-zA-Z0-9]+)/i);
      if (xtMatch) {
        result.infoHash = xtMatch[1].toLowerCase();
      }

      const xlMatch = magnetUri.match(/[?&]xl=([0-9]+)/);
      if (xlMatch) {
        result.sizeBytes = parseInt(xlMatch[1], 10);
      }

      return result;
    } catch (e) {
      return {};
    }
  }

  extractQuality(text) {
    if (!text) return 'HD';
    const resMatch = text.match(/\b(2160p|4k(?:\s*uhd)?|uhd|1080p|720p|480p)\b/i);
    if (resMatch) return resMatch[1].toUpperCase();
    const sourceMatch = text.match(/\b(web-dl|bluray|hdtc|dvdrip|hdr|camrip|hq|predvd)\b/i);
    return sourceMatch ? sourceMatch[1].toUpperCase() : 'HD';
  }

  extractSize(text) {
    if (!text) return null;
    const match = text.match(/\b(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB)\b/i);
    return match ? `${match[1]} ${match[2].toUpperCase()}` : null;
  }

  extractLanguage(text) {
    if (!text) return '';
    const match = text.match(/\b(Tamil|Telugu|Hindi|Malayalam|Kannada|English)\b/i);
    return match ? (match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()) : '';
  }

  parseMovieIdentity(rawTitle) {
    if (!rawTitle) return { groupKey: 'unknown', displayTitle: 'Unknown Movie', year: '', language: '' };
    let title = rawTitle.replace(/\b(Forums|Languages|Original Audio|HQ Clean|Clean Audio|ESub|Org Audio)\b/gi, '').trim();
    const yearMatch = title.match(/^(.*?)\s*\((\d{4})\)/i);
    let baseTitle = '';
    let year = '';
    if (yearMatch) {
      baseTitle = yearMatch[1].trim();
      year = yearMatch[2];
    } else {
      baseTitle = title.split(/[-–—\[]/)[0].replace(/\b(Tamil|Telugu|Hindi|Malayalam|Kannada|English)\b/gi, '').trim();
    }
    const langMatch = rawTitle.match(/\b(Tamil|Telugu|Hindi|Malayalam|Kannada|English)\b/i);
    const language = langMatch ? (langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase()) : '';
    const cleanBase = baseTitle.replace(/[-–—]\s*$/, '').trim();
    const displayTitle = cleanBase + (year ? ` (${year})` : '');
    const groupKey = displayTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    return { groupKey: groupKey || title.toLowerCase(), displayTitle: displayTitle || title, year, language };
  }

  groupMovies(movieList) {
    if (!Array.isArray(movieList)) return [];
    const map = new Map();

    for (const movie of movieList) {
      const info = this.parseMovieIdentity(movie.title);
      const key = info.groupKey;

      if (!map.has(key)) {
        map.set(key, {
          id: `group-${key}`,
          title: info.displayTitle,
          rawTitle: movie.title,
          year: info.year,
          poster: movie.poster || '',
          quality: movie.quality || 'HD',
          size: movie.size || 'Multi Size',
          seeds: movie.seeds || 0,
          leeches: movie.leeches || 0,
          languages: info.language ? [info.language] : [],
          magnets: [],
          detailUrls: movie.detailUrl ? [movie.detailUrl] : [],
          detailUrl: movie.detailUrl || '',
          isTopRelease: !!movie.isTopRelease,
          hasDetailPending: !!movie.hasDetailPending
        });
      }

      const group = map.get(key);
      if (!group.poster && movie.poster) group.poster = movie.poster;
      if (movie.seeds && movie.seeds > group.seeds) group.seeds = movie.seeds;
      if (info.language && !group.languages.includes(info.language)) {
        group.languages.push(info.language);
      }
      if (movie.detailUrl && !group.detailUrls.includes(movie.detailUrl)) {
        group.detailUrls.push(movie.detailUrl);
      }

      const incomingMagnets = (movie.magnets && movie.magnets.length > 0)
        ? movie.magnets
        : (movie.magnet ? [{ magnet: movie.magnet, quality: movie.quality, size: movie.size, title: movie.title }] : []);

      for (const m of incomingMagnets) {
        const magLang = m.language || info.language || '';
        const alreadyHas = group.magnets.some(x => 
          (m.infoHash && x.infoHash && x.infoHash === m.infoHash) || 
          (m.magnet && x.magnet && x.magnet === m.magnet) ||
          (m.quality === x.quality && m.size === x.size && (x.language === magLang))
        );
        if (!alreadyHas) {
          group.magnets.push({
            ...m,
            language: magLang,
            label: `${m.quality || 'HD'}${m.size ? ' • ' + m.size : ''}${magLang ? ' • ' + magLang : ''}`
          });
        }
      }

      if (group.magnets.length > 0) {
        group.hasDetailPending = false;
        if (!group.magnet) group.magnet = group.magnets[0].magnet;
      }
    }

    return Array.from(map.values());
  }

  cleanTitle(raw) {
    if (!raw) return '';
    return raw
      .replace(/\b(Forums|Tamil Language|Telugu Language|Hindi Language|Malayalam Language|WEB-HD|iTunes-HD|BluRay)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  resolveUrl(relativeOrAbsolute, baseUrl) {
    if (!relativeOrAbsolute) return '';
    try {
      const baseParsed = new URL(baseUrl);
      const resolved = new URL(relativeOrAbsolute, baseUrl);

      // Normalize www mismatch (e.g. site uses 1tamilmv.garden but link has www.1tamilmv.garden)
      if (baseParsed.hostname && !baseParsed.hostname.startsWith('www.') && resolved.hostname.startsWith('www.')) {
        if (resolved.hostname.replace(/^www\./, '') === baseParsed.hostname) {
          resolved.hostname = baseParsed.hostname;
          resolved.protocol = baseParsed.protocol;
        }
      }

      return resolved.href;
    } catch (e) {
      return relativeOrAbsolute;
    }
  }

  /**
   * Fetches raw HTML page from the target URL
   */
  async fetchHtml(targetUrl) {
    try {
      const response = await axios.get(targetUrl, {
        headers: this.getBrowserHeaders(),
        timeout: this.timeoutMs,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });

      const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const isCloudflare = html.includes('cf-browser-verification') || 
                           html.includes('Just a moment...') || 
                           html.includes('cf-challenge-running') ||
                           response.status === 403;

      return {
        ok: response.status >= 200 && response.status < 400 && !isCloudflare,
        status: response.status,
        html,
        finalUrl: response.request?.res?.responseUrl || targetUrl,
        isCloudflare
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        isCloudflare: error.response?.status === 403
      };
    }
  }

  /**
   * Universal DOM parser for movie cards and magnet links
   */
  parseSizeToBytes(sizeStr) {
    if (!sizeStr) return 0;
    const match = sizeStr.toString().trim().match(/^([\d.]+)\s*(KB|MB|GB|TB)$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    switch (unit) {
      case 'KB': return value * 1024;
      case 'MB': return value * 1024 * 1024;
      case 'GB': return value * 1024 * 1024 * 1024;
      case 'TB': return value * 1024 * 1024 * 1024 * 1024;
      default: return 0;
    }
  }

  /**
   * Universal DOM parser for movie cards and magnet links.
   * Prioritizes the Top Releases section exclusively when available.
   */
  parseMoviesFromHtml(html, baseUrl) {
    const $ = cheerio.load(html);
    const topReleases = [];
    const extraMovies = [];
    const seenUrls = new Set();
    const seenTitles = new Set();

    // Primary Strategy: Top Releases Section (.banger-row or .banger-container)
    const bangerRow = $('.banger-row, .banger-container').first();
    if (bangerRow.length > 0) {
      bangerRow.find('a[href*="/forums/topic/"]').each((idx, el) => {
        const href = $(el).attr('href');
        if (!href || href.includes('/topic/183-0') || href.includes('#')) return;

        // Clean query params / anchors from topic URL
        const cleanHref = href.split('&do=findComment')[0].split('#')[0];
        if (seenUrls.has(cleanHref)) return;
        seenUrls.add(cleanHref);

        // Extract title from text node preceding the <a> tag
        let prevText = '';
        let curr = el.prev;
        while (curr) {
          if (curr.type === 'text') {
            prevText = curr.data + prevText;
          } else if (curr.type === 'tag') {
            if (curr.name === 'br') break;
            prevText = $(curr).text() + prevText;
          }
          curr = curr.prev;
        }

        let title = prevText.replace(/\s+/g, ' ').replace(/[-–—]\s*$/, '').trim();
        const linkText = $(el).text().trim();
        const parent = $(el).closest('strong, p, li, div');
        const parentText = parent.text().replace(/\s+/g, ' ').trim();

        if (!title || title.length < 3) {
          if (linkText && linkText.includes('- [')) {
            title = linkText.split(/[-–—\[]/)[0].trim();
          } else if (parentText) {
            title = parentText.split(/[-–—\[]/)[0].trim();
          }
        }

        // Fallback to URL slug
        if (!title || title.length < 3) {
          const match = cleanHref.match(/\/topic\/\d+-(.+?)\/?$/);
          if (match) {
            title = decodeURIComponent(match[1]).replace(/-/g, ' ');
          }
        }

        title = this.cleanTitle(title);
        if (!title || title.length < 3 || seenTitles.has(title.toLowerCase())) return;
        seenTitles.add(title.toLowerCase());

        const quality = this.extractQuality(`${title} ${linkText} ${parentText}`);
        const size = this.extractSize(`${linkText} ${parentText}`);

        topReleases.push({
          id: `top-${idx}-${Date.now()}`,
          title,
          magnet: null,
          poster: '',
          size: size || 'Multi Quality',
          quality: quality || 'HD',
          seeds: 60,
          leeches: 5,
          detailUrl: this.resolveUrl(cleanHref, baseUrl),
          discoveredFrom: baseUrl,
          hasDetailPending: true,
          isTopRelease: true
        });
      });
    }

    // Secondary Strategy: Additional latest forum releases across the page
    $('a[href*="/forums/topic/"]').each((idx, el) => {
      if (extraMovies.length >= 60) return false;
      const href = $(el).attr('href');
      if (!href || href.includes('/topic/183-0') || href.includes('#')) return;

      const cleanHref = href.split('&do=findComment')[0].split('#')[0];
      if (seenUrls.has(cleanHref)) return;
      seenUrls.add(cleanHref);

      const parent = $(el).closest('strong, p, li, div');
      const parentText = parent.text().replace(/\s+/g, ' ').trim();
      let title = $(el).text().trim();
      if (!title || title.startsWith('[') || title.length < 3) {
        title = parentText.split(/[-–—\[]/)[0].trim();
      }

      if (!title || title.length < 3) {
        const match = cleanHref.match(/\/topic\/\d+-(.+?)\/?$/);
        if (match) {
          title = decodeURIComponent(match[1]).replace(/-/g, ' ');
        }
      }

      title = this.cleanTitle(title);
      if (!title || title.length < 3 || seenTitles.has(title.toLowerCase())) return;
      seenTitles.add(title.toLowerCase());

      const quality = this.extractQuality(`${title} ${parentText}`);
      const size = this.extractSize(`${title} ${parentText}`);

      extraMovies.push({
        id: `extra-${idx}-${Date.now()}`,
        title,
        magnet: null,
        poster: '',
        size: size || 'Multi Quality',
        quality: quality || 'HD',
        seeds: 35,
        leeches: 4,
        detailUrl: this.resolveUrl(cleanHref, baseUrl),
        discoveredFrom: baseUrl,
        hasDetailPending: true,
        isTopRelease: false
      });
    });

    return {
      topReleases,
      allMovies: [...topReleases, ...extraMovies],
      extraMovies
    };
  }

  /**
   * Fetches and scrapes a specific movie detail page for magnet links and poster
   */
  async fetchMovieDetail(detailUrl) {
    const fetchRes = await this.fetchHtml(detailUrl);
    if (!fetchRes.ok) {
      throw new Error(`Failed to load detail page: ${fetchRes.error || `HTTP ${fetchRes.status}`}`);
    }

    const $ = cheerio.load(fetchRes.html);
    const magnetLinks = [];
    const maxFileSizeBytes = (parseFloat(process.env.MAX_FILE_SIZE_GB || config.maxFileSizeGB || 4.5)) * 1024 * 1024 * 1024;

    $('a[href^="magnet:"]').each((_, el) => {
      const magnet = $(el).attr('href');
      if (!magnet) return;

      const meta = this.parseMagnetMetadata(magnet);
      const parent = $(el).closest('tr, p, div, li');
      const parentText = parent.length ? parent.text().replace(/\s+/g, ' ').trim() : '';

      const quality = this.extractQuality(meta.title) || this.extractQuality(parentText) || 'HD';

      let size = '';
      if (meta.sizeBytes) {
        if (meta.sizeBytes >= 1024 * 1024 * 1024) {
          size = `${(meta.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        } else {
          size = `${(meta.sizeBytes / (1024 * 1024)).toFixed(0)} MB`;
        }
      } else if (meta.title) {
        size = this.extractSize(meta.title);
      }
      if (!size) {
        size = this.extractSize(parentText) || '';
      }

      const sizeBytes = meta.sizeBytes || this.parseSizeToBytes(size);

      let cleanDn = meta.title || '';
      cleanDn = cleanDn.replace(/^www\.[a-zA-Z0-9.-]+\s*-\s*/i, '').trim();

      const pageTitle = $('h1, h2, .title, .entry-title').first().text().trim() || '';
      const language = this.extractLanguage(meta.title) || this.extractLanguage(parentText) || this.extractLanguage(detailUrl) || this.extractLanguage(pageTitle) || '';

      let label = `${quality}${size ? ` • ${size}` : ''}${language ? ` • ${language}` : ''}`;
      if (!quality && !size) label = cleanDn || $(el).text().trim() || 'Magnet Link';

      magnetLinks.push({
        magnet,
        label,
        quality,
        size,
        sizeBytes,
        language,
        infoHash: meta.infoHash,
        title: cleanDn || meta.title
      });
    });

    // Extract genuine movie poster (ignoring logos, reaction icons, border gifs)
    let poster = '';
    $('img').each((_, el) => {
      if (poster) return;
      const src = $(el).attr('data-src') || $(el).attr('src');
      if (!src) return;
      const lower = src.toLowerCase();
      if (
        lower.includes('logo') || 
        lower.includes('border') || 
        lower.includes('utorrent') || 
        lower.includes('reaction') || 
        lower.includes('avatar') || 
        lower.includes('badge') || 
        lower.includes('.svg') ||
        lower.endsWith('.svg') ||
        lower.startsWith('data:image/svg')
      ) {
        return;
      }
      if (src.includes('twimg.com') || src.includes('uploads/monthly') || $(el).hasClass('ipsImage') || lower.endsWith('.jpg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
        poster = this.resolveUrl(src, detailUrl);
      }
    });

    // Default primary magnet: pick preferred quality within Seedr limit (<= 4.5 GB)
    let primaryMagnet = null;
    if (magnetLinks.length > 0) {
      const validWithinLimit = magnetLinks.filter(m => !m.sizeBytes || m.sizeBytes <= maxFileSizeBytes);
      const candidates = validWithinLimit.length > 0 ? validWithinLimit : magnetLinks;
      const preferred = candidates.find(m => m.quality === '1080P' || m.quality === '720P') || candidates[0];
      primaryMagnet = preferred.magnet;
    }

    return {
      detailUrl,
      title: $('h1, h2, .title, .entry-title').first().text().trim() || 'Movie Details',
      magnets: magnetLinks,
      poster,
      magnet: primaryMagnet
    };
  }

  /**
   * Search movies/torrents from the active mirror by query
   */
  async searchTorrents(query) {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return [];
    }

    try {
      const discoveryResult = await mirrorDiscovery.discover();
      const domain = discoveryResult.domain;
      if (!domain) return [];

      const searchUrl = `${domain}/index.php?/search/&q=${encodeURIComponent(query.trim())}&type=forums_topic`;
      const res = await axios.get(searchUrl, {
        headers: this.getBrowserHeaders(domain),
        timeout: 8000,
        validateStatus: (status) => status < 400
      });

      if (!res.data || typeof res.data !== 'string') return [];

      const $ = cheerio.load(res.data);
      const topicLinks = [];
      const seenUrls = new Set();

      $('li.ipsStreamItem').slice(0, 5).each((_, el) => {
        const titleEl = $(el).find('.ipsStreamItem_title a').first();
        let href = titleEl.attr('href');
        if (!href) return;
        href = href.split('&do=findComment')[0].split('#')[0];
        const rawTitle = titleEl.text().trim();
        if (!rawTitle || rawTitle.includes('Languages') || rawTitle.length < 3) return;
        if (seenUrls.has(href)) return;
        seenUrls.add(href);

        topicLinks.push({
          title: rawTitle,
          url: this.resolveUrl(href, domain)
        });
      });

      if (topicLinks.length === 0) return [];

      const results = [];
      const maxFileSizeBytes = (parseFloat(process.env.MAX_FILE_SIZE_GB || config.maxFileSizeGB || 4.5)) * 1024 * 1024 * 1024;

      // Scrape detail pages in parallel for matched topics
      await Promise.allSettled(topicLinks.slice(0, 3).map(async (topic) => {
        try {
          const detail = await this.fetchMovieDetail(topic.url);
          if (detail.magnets && detail.magnets.length > 0) {
            for (const m of detail.magnets) {
              const meta = this.parseMagnetMetadata(m.magnet);
              const sizeBytes = m.sizeBytes || meta.sizeBytes || this.parseSizeToBytes(m.size);

              // Disallow files that exceed Seedr 4.5 GB limit
              if (sizeBytes > 0 && sizeBytes > maxFileSizeBytes) {
                continue;
              }

              let displayTitle = m.title || meta.title || topic.title;
              displayTitle = displayTitle.replace(/^www\.[a-zA-Z0-9.-]+\s*-\s*/i, '').trim();

              results.push({
                title: displayTitle,
                size: m.size || (sizeBytes ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Multi Quality'),
                sizeBytes: sizeBytes || 0,
                seeds: 75,
                leeches: 8,
                magnet: m.magnet,
                provider: '1TamilMV',
                time: 'Recent',
                quality: m.quality || 'HD',
                poster: detail.poster || ''
              });
            }
          }
        } catch (e) {
          // ignore individual topic detail error
        }
      }));

      return results;
    } catch (err) {
      console.warn('[MovieScraper] searchTorrents failed:', err.message);
      return [];
    }
  }

  /**
   * Main entry point: Discovers active domain and retrieves movies list
   */
  async getMovies(forceRediscover = false) {
    const discoveryResult = await mirrorDiscovery.discover(forceRediscover);
    const targetUrl = discoveryResult.fullUrl || discoveryResult.domain;

    if (!targetUrl) {
      throw new Error('No mirror domain resolved.');
    }

    console.log(`[MovieScraper] Fetching top releases from active mirror: ${targetUrl}`);
    const fetchResult = await this.fetchHtml(targetUrl);

    if (!fetchResult.ok) {
      if (fetchResult.isCloudflare) {
        return {
          success: false,
          error: 'Cloudflare / Anti-Bot protection detected on target mirror. You can configure an HTTP proxy or override with a working mirror domain.',
          domain: discoveryResult.domain,
          keyword: discoveryResult.keyword,
          isCloudflare: true,
          movies: []
        };
      }

      if (!forceRediscover) {
        console.log('[MovieScraper] Primary domain failed, forcing re-discovery...');
        return this.getMovies(true);
      }

      throw new Error(`Failed to access mirror at ${targetUrl}: ${fetchResult.error || `HTTP ${fetchResult.status}`}`);
    }

    const { topReleases, allMovies } = this.parseMoviesFromHtml(fetchResult.html, targetUrl);
    let resolvedTop = topReleases || [];
    let resolvedAll = allMovies || resolvedTop;

    // If 0 releases found and target domain is not the configured fallback, try the fallback domain
    if (resolvedTop.length === 0 && resolvedAll.length === 0) {
      const cfg = config.mirrorDiscovery || {};
      const fbDomain = cfg.fallbackDomain ? cfg.fallbackDomain.trim().replace(/\/+$/, '') : '';
      const currentClean = targetUrl.replace(/\/+$/, '');
      if (fbDomain && currentClean !== fbDomain) {
        console.log(`[MovieScraper] 0 releases found on ${targetUrl}, trying fallback domain ${fbDomain}...`);
        const fallbackRes = await this.fetchHtml(fbDomain);
        if (fallbackRes.ok) {
          const fbParsed = this.parseMoviesFromHtml(fallbackRes.html, fbDomain);
          if ((fbParsed.topReleases?.length || 0) > 0 || (fbParsed.allMovies?.length || 0) > 0) {
            resolvedTop = fbParsed.topReleases || [];
            resolvedAll = fbParsed.allMovies || resolvedTop;
            targetUrl = fbDomain;
            try {
              mirrorDiscovery.setManualDomain(fbDomain);
            } catch (e) {
              // ignore
            }
          }
        }
      }
    }

    // Auto-resolve magnets and posters in parallel for all Top Releases
    const pendingWithDetail = resolvedTop.filter(m => m.hasDetailPending);
    if (pendingWithDetail.length > 0) {
      await Promise.allSettled(pendingWithDetail.map(async (item) => {
        try {
          const detailData = await this.fetchMovieDetail(item.detailUrl);
          if (detailData.magnet) {
            item.magnet = detailData.magnet;
            item.magnets = detailData.magnets || [];
            item.hasDetailPending = false;
            if (detailData.poster && !item.poster) item.poster = detailData.poster;
            if (detailData.magnets?.[0]?.size && item.size === 'Multi Quality') {
              item.size = detailData.magnets[0].size;
            }
          }
        } catch (e) {
          // Keep item as is
        }
      }));
    }

    const groupedTop = this.groupMovies(resolvedTop);
    const groupedAll = this.groupMovies(resolvedAll);

    return {
      success: true,
      domain: discoveryResult.domain,
      fullUrl: targetUrl,
      keyword: discoveryResult.keyword,
      searchEngine: discoveryResult.engine,
      cachedDomain: discoveryResult.cached || false,
      discoveredAt: discoveryResult.discoveredAt,
      topReleases: groupedTop,
      movies: groupedTop,
      allMovies: groupedAll,
      count: groupedTop.length,
      totalCount: groupedAll.length,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new MovieScraperService();
