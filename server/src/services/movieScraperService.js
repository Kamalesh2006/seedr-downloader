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
    const match = text.match(/\b(2160p|4K\s*UHD|4K|UHD|1080p|720p|480p|WEB-DL|BluRay|HDTC|DVDRip|HDR|CAMRip|HQ|PreDVD)\b/i);
    return match ? match[1].toUpperCase() : 'HD';
  }

  extractSize(text) {
    if (!text) return null;
    const match = text.match(/\b(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB)\b/i);
    return match ? `${match[1]} ${match[2].toUpperCase()}` : null;
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
    const movies = [];
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

        movies.push({
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

      // If we got top releases, ONLY return the top releases! Do not show the rest of the forum.
      if (movies.length > 0) {
        return movies;
      }
    }

    // Secondary Strategy: Direct magnets on page if any
    $('a[href^="magnet:"]').each((idx, el) => {
      if (movies.length >= 20) return false;

      const magnet = $(el).attr('href');
      if (!magnet || seenUrls.has(magnet)) return;
      seenUrls.add(magnet);

      const magnetMeta = this.parseMagnetMetadata(magnet);
      const container = $(el).closest('tr, article, .item, .card, .movie, .torrent, .post, .topic, .film, li, div[class*="row"], div[class*="card"]');
      const containerText = container.length ? container.text() : '';

      let title = $(el).attr('title') || $(el).text().trim();
      if (!title || title.toLowerCase().includes('magnet') || title.toLowerCase().includes('download') || title.length < 3) {
        const heading = container.find('h1, h2, h3, h4, .title, .name, a[class*="title"]').first();
        if (heading.length && heading.text().trim()) {
          title = heading.text().trim();
        } else if (magnetMeta.title) {
          title = magnetMeta.title;
        } else {
          title = 'Movie ' + (idx + 1);
        }
      }

      let poster = '';
      const imgEl = container.find('img').first();
      if (imgEl.length) {
        const rawSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src');
        poster = this.resolveUrl(rawSrc, baseUrl);
      }

      const size = this.extractSize(containerText) || (magnetMeta.sizeBytes ? `${(magnetMeta.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : null);
      const quality = this.extractQuality(`${title} ${containerText}`);

      movies.push({
        id: magnetMeta.infoHash || `movie-${idx}-${Date.now()}`,
        title: this.cleanTitle(title),
        magnet,
        infoHash: magnetMeta.infoHash || '',
        poster,
        size: size || 'Unknown size',
        quality,
        seeds: 50,
        leeches: 5,
        detailUrl: baseUrl,
        discoveredFrom: baseUrl
      });
    });

    return movies;
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

      let label = `${quality}${size ? ` • ${size}` : ''}`;
      if (!quality && !size) label = cleanDn || $(el).text().trim() || 'Magnet Link';

      magnetLinks.push({
        magnet,
        label,
        quality,
        size,
        sizeBytes,
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

    const movies = this.parseMoviesFromHtml(fetchResult.html, targetUrl);

    // Auto-resolve magnets and posters in parallel for all Top Releases
    const pendingWithDetail = movies.filter(m => m.hasDetailPending);
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

    return {
      success: true,
      domain: discoveryResult.domain,
      fullUrl: targetUrl,
      keyword: discoveryResult.keyword,
      searchEngine: discoveryResult.engine,
      cachedDomain: discoveryResult.cached || false,
      discoveredAt: discoveryResult.discoveredAt,
      movies,
      count: movies.length,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new MovieScraperService();
