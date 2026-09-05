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
  parseMoviesFromHtml(html, baseUrl) {
    const $ = cheerio.load(html);
    const movies = [];
    const seenMagnets = new Set();
    const seenTitles = new Set();

    // Strategy 1: Look for direct magnet links inside cards, articles, table rows or lists
    $('a[href^="magnet:"]').each((idx, el) => {
      if (movies.length >= this.maxMovies) return false;

      const magnet = $(el).attr('href');
      if (!magnet || seenMagnets.has(magnet)) return;
      seenMagnets.add(magnet);

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

      let seeds = 0;
      let leeches = 0;
      const seedMatch = containerText.match(/seeds?[:\s]*(\d+)/i) || container.find('.seeds, .green, [class*="seed"]').first().text().match(/(\d+)/);
      if (seedMatch) seeds = parseInt(seedMatch[1], 10);

      const leechMatch = containerText.match(/leech(?:ers?)?[:\s]*(\d+)/i) || container.find('.leeches, .red, [class*="leech"]').first().text().match(/(\d+)/);
      if (leechMatch) leeches = parseInt(leechMatch[1], 10);

      let detailUrl = '';
      const detailLinkEl = container.find('a[href]:not([href^="magnet:"])').first();
      if (detailLinkEl.length) {
        detailUrl = this.resolveUrl(detailLinkEl.attr('href'), baseUrl);
      }

      movies.push({
        id: magnetMeta.infoHash || `movie-${idx}-${Date.now()}`,
        title: this.cleanTitle(title),
        magnet,
        infoHash: magnetMeta.infoHash || '',
        poster,
        size: size || 'Unknown size',
        quality,
        seeds,
        leeches,
        detailUrl: detailUrl || baseUrl,
        discoveredFrom: baseUrl
      });
    });

    // Strategy 1.5: Invision Power Board / IPS Forum Topics (e.g. 1tamilmv.meme)
    if (movies.length === 0) {
      $('a[href*="/forums/topic/"]').each((idx, el) => {
        if (movies.length >= this.maxMovies) return false;
        const href = $(el).attr('href');
        if (!href || href.includes('/topic/183-0') || href.includes('#')) return;

        const parent = $(el).closest('strong, p, li, div');
        const fullText = parent.text().replace(/\s+/g, ' ').trim();
        let title = $(el).text().trim();
        if (!title || title.startsWith('[') || title.length < 3) {
          const parts = fullText.split(/[-–—\[]/);
          title = parts[0].trim();
        }

        title = this.cleanTitle(title);
        if (!title || title.length < 3 || seenTitles.has(title)) return;
        seenTitles.add(title);
        seenMagnets.add(href);

        const size = this.extractSize(fullText);
        const quality = this.extractQuality(fullText);

        movies.push({
          id: `topic-${idx}-${Date.now()}`,
          title,
          magnet: null,
          poster: '',
          size: size || 'Multi Quality',
          quality,
          seeds: 0,
          leeches: 0,
          detailUrl: this.resolveUrl(href, baseUrl),
          discoveredFrom: baseUrl,
          hasDetailPending: true
        });
      });
    }

    // Strategy 2: If no direct magnets found on front page, extract movie post entries
    if (movies.length === 0) {
      // Find candidate links that look like movie posts or detail pages
      $('a[href]').each((idx, el) => {
        if (movies.length >= this.maxMovies) return false;

        const href = $(el).attr('href');
        if (!href) return;

        const isPostLink = href.endsWith('.html') || 
                           /\/(?:202\d|movie|torrent|view|topic|thread|details)\//i.test(href);

        if (!isPostLink) return;

        const detailUrl = this.resolveUrl(href, baseUrl);
        if (!detailUrl || detailUrl === baseUrl || detailUrl.includes('javascript:') || detailUrl.includes('/search/label/')) return;

        const container = $(el).closest('article, .item, .card, .movie-card, .movie, .film, .post-item, .entry, .post, tr, div[class*="post"]');
        
        let title = '';
        if (container.length) {
          title = container.find('h1, h2, h3, h4, .title, .entry-title').first().text().trim();
        }
        if (!title) {
          title = $(el).text().trim();
        }

        title = this.cleanTitle(title);
        if (!title || title.length < 3 || seenTitles.has(title)) return;
        seenTitles.add(title);

        let poster = '';
        if (container.length) {
          const imgEl = container.find('img').first();
          if (imgEl.length) {
            const rawSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src');
            poster = this.resolveUrl(rawSrc, baseUrl);
          }
        }

        const containerText = container.length ? container.text() : '';
        const quality = this.extractQuality(`${title} ${containerText}`);
        const size = this.extractSize(containerText);

        movies.push({
          id: `entry-${idx}-${Date.now()}`,
          title,
          magnet: null,
          poster,
          size: size || 'Multi Quality',
          quality,
          seeds: 0,
          leeches: 0,
          detailUrl,
          discoveredFrom: baseUrl,
          hasDetailPending: true
        });
      });
    }

    return movies;
  }

  /**
   * Fetches and scrapes a specific movie detail page for magnet links
   */
  async fetchMovieDetail(detailUrl) {
    const fetchRes = await this.fetchHtml(detailUrl);
    if (!fetchRes.ok) {
      throw new Error(`Failed to load detail page: ${fetchRes.error || `HTTP ${fetchRes.status}`}`);
    }

    const $ = cheerio.load(fetchRes.html);
    const magnetLinks = [];

    $('a[href^="magnet:"]').each((_, el) => {
      const magnet = $(el).attr('href');
      if (!magnet) return;

      const meta = this.parseMagnetMetadata(magnet);
      const parent = $(el).closest('tr, p, div, li');
      const parentText = parent.length ? parent.text().replace(/\s+/g, ' ').trim() : '';

      const quality = this.extractQuality(parentText) || this.extractQuality(meta.title);
      const size = this.extractSize(parentText) || (meta.sizeBytes ? `${(meta.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : '');

      let label = `${quality}${size ? ` • ${size}` : ''}`;
      if (!quality && !size) label = $(el).text().trim() || meta.title || 'Magnet Link';

      magnetLinks.push({
        magnet,
        label,
        quality,
        size,
        infoHash: meta.infoHash,
        title: meta.title
      });
    });

    let poster = '';
    const imgEl = $('img').first();
    if (imgEl.length) {
      const rawSrc = imgEl.attr('data-src') || imgEl.attr('src');
      poster = this.resolveUrl(rawSrc, detailUrl);
    }

    // Default magnet: pick 1080p, 720p, or first available
    let primaryMagnet = null;
    if (magnetLinks.length > 0) {
      const preferred = magnetLinks.find(m => m.quality === '1080P' || m.quality === '720P') || magnetLinks[0];
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
   * Main entry point: Discovers active domain and retrieves movies list
   */
  async getMovies(forceRediscover = false) {
    const discoveryResult = await mirrorDiscovery.discover(forceRediscover);
    const targetUrl = discoveryResult.fullUrl || discoveryResult.domain;

    if (!targetUrl) {
      throw new Error('No mirror domain resolved.');
    }

    console.log(`[MovieScraper] Fetching movies from active mirror: ${targetUrl}`);
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

    // If movies have detail pages, auto-resolve magnets for the first 8 items in parallel
    const pendingWithDetail = movies.filter(m => m.hasDetailPending).slice(0, 8);
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
