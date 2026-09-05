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
    const match = text.match(/\b(2160p|4K|UHD|1080p|720p|480p|WEB-DL|BluRay|HDTC|DVDRip|HDR|CAMRip|HQ|PreDVD)\b/i);
    return match ? match[1].toUpperCase() : 'HD';
  }

  extractSize(text) {
    if (!text) return null;
    const match = text.match(/\b(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB)\b/i);
    return match ? `${match[1]} ${match[2].toUpperCase()}` : null;
  }

  resolveUrl(relativeOrAbsolute, baseUrl) {
    if (!relativeOrAbsolute) return '';
    try {
      return new URL(relativeOrAbsolute, baseUrl).href;
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

      // Check for Cloudflare interstitial
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

      // Find closest container that encapsulates this movie item
      const container = $(el).closest('tr, article, .item, .card, .movie, .torrent, .post, .topic, .film, li, div[class*="row"], div[class*="card"]');
      const containerText = container.length ? container.text() : '';

      // Determine movie title
      let title = $(el).attr('title') || $(el).text().trim();
      if (!title || title.toLowerCase().includes('magnet') || title.toLowerCase().includes('download') || title.length < 3) {
        // Try finding a heading in container
        const heading = container.find('h1, h2, h3, h4, .title, .name, a[class*="title"]').first();
        if (heading.length && heading.text().trim()) {
          title = heading.text().trim();
        } else if (magnetMeta.title) {
          title = magnetMeta.title;
        } else {
          title = 'Movie ' + (idx + 1);
        }
      }

      // Poster image
      let poster = '';
      const imgEl = container.find('img').first();
      if (imgEl.length) {
        const rawSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src');
        poster = this.resolveUrl(rawSrc, baseUrl);
      }

      // Size
      let size = this.extractSize(containerText) || (magnetMeta.sizeBytes ? `${(magnetMeta.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : null);

      // Quality
      const quality = this.extractQuality(`${title} ${containerText}`);

      // Seeders / Peers
      let seeds = 0;
      let leeches = 0;
      const seedMatch = containerText.match(/seeds?[:\s]*(\d+)/i) || container.find('.seeds, .green, [class*="seed"]').first().text().match(/(\d+)/);
      if (seedMatch) seeds = parseInt(seedMatch[1], 10);

      const leechMatch = containerText.match(/leech(?:ers?)?[:\s]*(\d+)/i) || container.find('.leeches, .red, [class*="leech"]').first().text().match(/(\d+)/);
      if (leechMatch) leeches = parseInt(leechMatch[1], 10);

      // Detail link
      let detailUrl = '';
      const detailLinkEl = container.find('a[href]:not([href^="magnet:"])').first();
      if (detailLinkEl.length) {
        detailUrl = this.resolveUrl(detailLinkEl.attr('href'), baseUrl);
      }

      movies.push({
        id: magnetMeta.infoHash || `movie-${idx}-${Date.now()}`,
        title: title.replace(/\s+/g, ' ').trim(),
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

    // Strategy 2: If no direct magnet links were found on the main page,
    // look for movie post cards that link to detail pages
    if (movies.length === 0) {
      $('article, .item, .card, .movie-card, .movie, .film, .post-item, .entry').each((idx, el) => {
        if (movies.length >= 20) return false;

        const container = $(el);
        const linkEl = container.find('a[href]').first();
        if (!linkEl.length) return;

        const href = linkEl.attr('href');
        const detailUrl = this.resolveUrl(href, baseUrl);
        if (!detailUrl || detailUrl === baseUrl || detailUrl.includes('javascript:')) return;

        let title = container.find('h1, h2, h3, h4, .title, .entry-title').first().text().trim() || linkEl.text().trim();
        if (!title || seenTitles.has(title)) return;
        seenTitles.add(title);

        let poster = '';
        const imgEl = container.find('img').first();
        if (imgEl.length) {
          const rawSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src');
          poster = this.resolveUrl(rawSrc, baseUrl);
        }

        const containerText = container.text();
        const quality = this.extractQuality(`${title} ${containerText}`);
        const size = this.extractSize(containerText);

        movies.push({
          id: `entry-${idx}`,
          title: title.replace(/\s+/g, ' ').trim(),
          magnet: null, // Needs detail fetch or click
          poster,
          size: size || 'Check Details',
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
      if (magnet) {
        const text = $(el).text().trim() || $(el).attr('title') || 'Magnet Link';
        const meta = this.parseMagnetMetadata(magnet);
        magnetLinks.push({
          magnet,
          label: text,
          infoHash: meta.infoHash,
          title: meta.title
        });
      }
    });

    const poster = $('img').first().attr('src');
    const resolvedPoster = poster ? this.resolveUrl(poster, detailUrl) : '';

    return {
      detailUrl,
      title: $('h1, h2, .title').first().text().trim() || 'Movie Details',
      magnets: magnetLinks,
      poster: resolvedPoster,
      magnet: magnetLinks.length > 0 ? magnetLinks[0].magnet : null
    };
  }

  /**
   * Main entry point: Discovers active domain and retrieves movies list
   */
  async getMovies(forceRediscover = false) {
    // 1. Resolve active mirror domain
    const discoveryResult = await mirrorDiscovery.discover(forceRediscover);
    const targetUrl = discoveryResult.fullUrl || discoveryResult.domain;

    if (!targetUrl) {
      throw new Error('No mirror domain resolved.');
    }

    console.log(`[MovieScraper] Fetching movies from active mirror: ${targetUrl}`);

    // 2. Fetch page HTML
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

      // If fetching the domain failed, try forcing a rediscovery once
      if (!forceRediscover) {
        console.log('[MovieScraper] Primary domain failed, forcing re-discovery...');
        return this.getMovies(true);
      }

      throw new Error(`Failed to access mirror at ${targetUrl}: ${fetchResult.error || `HTTP ${fetchResult.status}`}`);
    }

    // 3. Parse movie listings and magnet links
    const movies = this.parseMoviesFromHtml(fetchResult.html, targetUrl);

    // If movies have detail pages and no magnets on the front page, resolve the first 4 in parallel
    const pendingWithDetail = movies.filter(m => m.hasDetailPending).slice(0, 4);
    if (pendingWithDetail.length > 0) {
      await Promise.allSettled(pendingWithDetail.map(async (item) => {
        try {
          const detailData = await this.fetchMovieDetail(item.detailUrl);
          if (detailData.magnet) {
            item.magnet = detailData.magnet;
            item.hasDetailPending = false;
            if (detailData.poster && !item.poster) item.poster = detailData.poster;
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
