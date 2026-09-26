const TorrentSearchApi = require('torrent-search-api');
const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const config = require('../../config.json');
const movieScraperService = require('./movieScraperService');

// Initially enable all providers with default settings
for (const provider of config.searchProviders || []) {
  try {
    TorrentSearchApi.enableProvider(provider.name);
  } catch (error) {
    console.error(`Failed to enable provider ${provider.name}:`, error.message);
  }
}

function getProxyAgent() {
  const proxyUrl = process.env.PROXY_URL || config.proxyUrl || config.proxy;
  if (!proxyUrl || typeof proxyUrl !== 'string' || !proxyUrl.trim()) return null;
  const clean = proxyUrl.trim();
  try {
    if (clean.startsWith('socks')) {
      return new SocksProxyAgent(clean);
    }
    return new HttpsProxyAgent(clean);
  } catch (err) {
    console.warn('[SearchService] Invalid proxy configuration:', clean, err.message);
    return null;
  }
}

function getAxiosNetworkConfig() {
  const agent = getProxyAgent();
  if (agent) {
    return { httpsAgent: agent, httpAgent: agent };
  }
  // When no custom proxy is configured, explicitly disable default env proxy inheritance
  // to avoid local corporate proxies (e.g. 127.0.0.1:3128) from interfering with torrent traffic
  return { proxy: false };
}

function parseSizeToBytes(sizeStr) {
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

class SearchService {
  constructor() {
    this.maxFileSizeGB = parseFloat(process.env.MAX_FILE_SIZE_GB || config.maxFileSizeGB || 4.5);
    this.maxFileSizeBytes = this.maxFileSizeGB * 1024 * 1024 * 1024;
  }

  async searchYts(query) {
    const ytsCfg = (config.searchProviders || []).find(p => p.name.toLowerCase() === 'yts') || {};
    const mirrors = (ytsCfg.urls && ytsCfg.urls.length > 0)
      ? ytsCfg.urls
      : ['https://yts.am', 'https://yts.gg', 'https://yts.mx', 'https://yts.lt'];

    const networkCfg = getAxiosNetworkConfig();

    const mirrorPromises = mirrors.map(async (mirror) => {
      const cleanMirror = mirror.replace(/\/+$/, '');
      const url = `${cleanMirror}/api/v2/list_movies.json?query_term=${encodeURIComponent(query.trim())}&sort=seeds&order=desc`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        ...networkCfg,
        timeout: 5000
      });

      if (res.data?.data?.movies && Array.isArray(res.data.data.movies)) {
        const results = [];
        for (const movie of res.data.data.movies) {
          if (!movie.torrents) continue;
          for (const t of movie.torrents) {
            if (!t.hash) continue;
            const title = `${movie.title} (${movie.year}) [${t.quality || 'HD'}] [${(t.type || 'WEB').toUpperCase()}] [YTS]`;
            const magnet = `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(title)}&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.coppersurfer.tk:6969&tr=udp://glotorrents.pw:6969/announce&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://torrent.gresille.org:80/announce&tr=udp://p4p.arenabg.com:1337`;
            const sizeBytes = t.size_bytes || parseSizeToBytes(t.size);

            results.push({
              title,
              size: t.size || (sizeBytes ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown'),
              sizeBytes: sizeBytes || 0,
              seeds: parseInt(t.seeds, 10) || 0,
              leeches: parseInt(t.peers, 10) || 0,
              magnet,
              provider: 'YTS',
              time: t.date_uploaded
            });
          }
        }
        if (results.length > 0) return results;
      }
      throw new Error('No movies');
    });

    try {
      return await Promise.any(mirrorPromises);
    } catch (e) {
      return [];
    }
  }

  async searchThePirateBay(query, debugLog = null) {
    const tpbCfg = (config.searchProviders || []).find(p => p.name.toLowerCase() === 'thepiratebay') || {};
    
    // Support custom environment overrides for API / Worker / Reverse Proxy
    const envCustomMirrors = [
      process.env.APIBAY_URL,
      process.env.TPB_API_URL,
      process.env.TPB_MIRROR_URL
    ].filter(u => u && typeof u === 'string' && u.trim());

    const defaultMirrors = [
      'https://apibay.org',
      'https://thepiratebay10.org',
      'https://tpb.party',
      'https://thehiddenbay.com',
      'https://piratebayproxy.live',
      'https://pirateproxy.live',
      'https://thepiratebay.zone',
      'https://thepiratebay0.org'
    ];

    const configuredMirrors = (tpbCfg.urls && tpbCfg.urls.length > 0)
      ? tpbCfg.urls
      : defaultMirrors;

    const mirrors = [...new Set([...envCustomMirrors, ...configuredMirrors])];

    const networkCfg = getAxiosNetworkConfig();
    const cleanQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() || query.trim();

    // Helper: Parse HTML search result table from TPB proxy / mirror
    const parseTpbHtml = (html) => {
      try {
        const $ = cheerio.load(html);
        const results = [];

        $('table#searchResult tr, table tr').each((_, el) => {
          const $row = $(el);
          const magnetLink = $row.find('a[href^="magnet:"]').first().attr('href');
          if (!magnetLink) return;

          const titleLink = $row.find('.detName a, a.detLink, td:nth-child(2) a').first();
          const title = titleLink.text().trim();
          if (!title) return;

          let seeds = 0;
          let leeches = 0;
          const alignRightTds = $row.find('td[align="right"]');
          if (alignRightTds.length >= 2) {
            seeds = parseInt($(alignRightTds[0]).text().trim(), 10) || 0;
            leeches = parseInt($(alignRightTds[1]).text().trim(), 10) || 0;
          } else {
            const tds = $row.find('td');
            if (tds.length >= 4) {
              seeds = parseInt($(tds[tds.length - 2]).text().trim(), 10) || 0;
              leeches = parseInt($(tds[tds.length - 1]).text().trim(), 10) || 0;
            }
          }

          let sizeStr = 'Unknown';
          const detDesc = $row.find('.detDesc, font.detDesc').text();
          const sizeMatch = detDesc.match(/Size\s+([\d.]+\s*(?:[KMGT]i?B|bytes))/i);
          if (sizeMatch) {
            sizeStr = sizeMatch[1].trim();
          } else {
            $row.find('td').each((_, td) => {
              const text = $(td).text().trim();
              if (/^[\d.]+\s*(?:[KMGT]i?B|bytes)$/i.test(text)) {
                sizeStr = text;
              }
            });
          }

          results.push({
            title,
            size: sizeStr,
            sizeBytes: parseSizeToBytes(sizeStr),
            seeds,
            leeches,
            magnet: magnetLink,
            provider: 'ThePirateBay'
          });
        });

        return results;
      } catch (err) {
        return [];
      }
    };

    const fetchFromMirror = async (mirror, q) => {
      const cleanMirror = mirror.replace(/\/+$/, '');
      const isApibay = cleanMirror.includes('apibay') || cleanMirror.includes('api.php') || envCustomMirrors.includes(mirror);

      // Candidate request targets for this mirror:
      // 1. JSON API endpoint (/q.php?q=...)
      // 2. HTML search page (/search/.../1/99/0) for mirrors serving HTML
      const targets = [];
      if (cleanMirror.includes('api.php')) {
        targets.push({ url: `${cleanMirror}${encodeURIComponent('/q.php?q=' + q)}`, isJson: true });
      } else if (isApibay) {
        targets.push({ url: `${cleanMirror}/q.php?q=${encodeURIComponent(q)}`, isJson: true });
      } else {
        targets.push({ url: `${cleanMirror}/q.php?q=${encodeURIComponent(q)}`, isJson: true });
        targets.push({ url: `${cleanMirror}/search/${encodeURIComponent(q)}/1/99/0`, isJson: false });
      }

      for (const target of targets) {
        try {
          const res = await axios.get(target.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': target.isJson ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': `${cleanMirror}/`
            },
            ...networkCfg,
            signal: AbortSignal.timeout(4500)
          });

          // Check if response is JSON array (Apibay format)
          if (Array.isArray(res.data) && res.data.length > 0 && res.data[0].id !== '0' && res.data[0].name !== 'No results returned') {
            const results = [];
            for (const item of res.data) {
              if (!item.info_hash) continue;
              const sizeBytes = parseInt(item.size, 10) || 0;
              let sizeStr = 'Unknown';
              if (sizeBytes >= 1024 * 1024 * 1024) {
                sizeStr = `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
              } else if (sizeBytes >= 1024 * 1024) {
                sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
              } else if (sizeBytes > 0) {
                sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
              }

              const magnet = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=udp%3A%2F%2Ftracker.dler.org%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce`;

              results.push({
                title: item.name,
                size: sizeStr,
                sizeBytes,
                seeds: parseInt(item.seeders, 10) || 0,
                leeches: parseInt(item.leechers, 10) || 0,
                magnet,
                provider: 'ThePirateBay',
                time: item.added ? new Date(parseInt(item.added, 10) * 1000).toLocaleDateString() : undefined
              });
            }
            if (results.length > 0) {
              if (debugLog) debugLog.push({ mirror, status: res.status, format: 'json', count: results.length });
              return results;
            }
          }

          // Check if response is HTML search table
          if (typeof res.data === 'string' && (res.data.includes('searchResult') || res.data.includes('magnet:?'))) {
            const htmlResults = parseTpbHtml(res.data);
            if (htmlResults.length > 0) {
              if (debugLog) debugLog.push({ mirror, status: res.status, format: 'html', count: htmlResults.length });
              return htmlResults;
            }
          }
        } catch (err) {
          if (debugLog) {
            debugLog.push({
              mirror,
              url: target.url,
              error: err.message,
              statusCode: err.response?.status
            });
          }
        }
      }

      throw new Error('No valid results returned from ' + mirror);
    };

    // Query mirrors in parallel using Promise.any
    try {
      const mirrorPromises = mirrors.map(mirror => fetchFromMirror(mirror, cleanQuery));
      const res = await Promise.any(mirrorPromises);
      if (res && res.length > 0) return res;
    } catch (err) {
      // If cleanQuery had no results and differed from original query, try original
      if (query.trim() !== cleanQuery) {
        try {
          const mirrorPromises = mirrors.map(mirror => fetchFromMirror(mirror, query.trim()));
          const res = await Promise.any(mirrorPromises);
          if (res && res.length > 0) return res;
        } catch (e) {}
      }
    }

    // Fallback to TorrentSearchApi for ThePirateBay if direct mirrors failed
    try {
      const providerInstance = TorrentSearchApi.getProvider('ThePirateBay', false);
      if (providerInstance) {
        const searchPromise = providerInstance.search(cleanQuery, 'All', Math.max(config.maxResults || 25, 40));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000));
        const results = await Promise.race([searchPromise, timeoutPromise]);
        if (Array.isArray(results) && results.length > 0) {
          const mapped = results.filter(t => t.magnet || (t.link && t.link.startsWith('magnet:?'))).map(t => ({
            title: t.title,
            size: t.size || 'Unknown',
            sizeBytes: parseSizeToBytes(t.size),
            seeds: parseInt(t.seeds, 10) || 0,
            leeches: parseInt(t.peers || t.leechs || 0, 10) || 0,
            magnet: t.magnet || t.link,
            provider: 'ThePirateBay',
            time: t.time
          }));
          if (debugLog) debugLog.push({ fallback: 'TorrentSearchApi', count: mapped.length });
          return mapped;
        }
      }
    } catch (e) {
      if (debugLog) debugLog.push({ fallback: 'TorrentSearchApi', error: e.message });
    }

    return [];
  }

  async searchTorrentsCsv(query) {
    try {
      const cleanQuery = query.trim();
      const networkCfg = getAxiosNetworkConfig();
      const res = await axios.get(`https://torrents-csv.com/service/search?q=${encodeURIComponent(cleanQuery)}&size=30`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
        },
        ...networkCfg,
        signal: AbortSignal.timeout(5000)
      });

      if (res.data && Array.isArray(res.data.torrents)) {
        const results = [];
        for (const item of res.data.torrents) {
          if (!item.infohash) continue;
          const sizeBytes = item.size_bytes || 0;
          let sizeStr = 'Unknown';
          if (sizeBytes >= 1024 * 1024 * 1024) {
            sizeStr = `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
          } else if (sizeBytes >= 1024 * 1024) {
            sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
          } else if (sizeBytes > 0) {
            sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
          }

          const magnet = `magnet:?xt=urn:btih:${item.infohash}&dn=${encodeURIComponent(item.name)}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce`;

          results.push({
            title: item.name,
            size: sizeStr,
            sizeBytes,
            seeds: parseInt(item.seeders, 10) || 0,
            leeches: parseInt(item.leechers, 10) || 0,
            magnet,
            provider: 'TorrentsCSV',
            time: item.created_unix ? new Date(item.created_unix * 1000).toLocaleDateString() : undefined
          });
        }
        return results;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  async search1337x(query) {
    const x1337Cfg = (config.searchProviders || []).find(p => p.name === '1337x') || {};
    const mirrors = (x1337Cfg.urls && x1337Cfg.urls.length > 0)
      ? x1337Cfg.urls
      : [
          'https://1337x.to',
          'https://1337x.st',
          'https://x1337x.ws',
          'https://x1337x.eu',
          'https://x1337x.se',
          'https://x1337x.cc'
        ];

    const networkCfg = getAxiosNetworkConfig();
    const cleanQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanQuery) return [];

    const fetchMirror = async (mirror) => {
      const cleanMirror = mirror.replace(/\/+$/, '');
      const searchUrl = `${cleanMirror}/search/${encodeURIComponent(cleanQuery)}/1/`;
      const res = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        ...networkCfg,
        signal: AbortSignal.timeout(3500)
      });

      if (res.data && typeof res.data === 'string' && res.data.includes('table-list')) {
        const $ = cheerio.load(res.data);
        const rows = $('table.table-list tbody tr');
        if (rows.length > 0) {
          const list = [];
          rows.slice(0, 15).each((_, el) => {
            const titleLink = $(el).find('td.name a:nth-child(2)');
            const title = titleLink.text().trim();
            const href = titleLink.attr('href');
            if (!title || !href) return;

            const seeds = parseInt($(el).find('td.seeds').text().trim(), 10) || 0;
            const leeches = parseInt($(el).find('td.leeches').text().trim(), 10) || 0;
            const size = $(el).find('td.size').clone().children().remove().end().text().trim();
            const detailUrl = cleanMirror + (href.startsWith('/') ? '' : '/') + href;

            list.push({
              title,
              size: size || 'Unknown',
              sizeBytes: parseSizeToBytes(size),
              seeds,
              leeches,
              provider: '1337x',
              detailUrl,
              time: $(el).find('td.coll-date').text().trim() || undefined
            });
          });

          if (list.length > 0) {
            const topCandidates = list.slice(0, 6);
            await Promise.allSettled(topCandidates.map(async (item) => {
              try {
                const dRes = await axios.get(item.detailUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': searchUrl
                  },
                  ...networkCfg,
                  signal: AbortSignal.timeout(3000)
                });
                if (dRes.data) {
                  const $d = cheerio.load(dRes.data);
                  const mag = $d('a[href^="magnet:"]').first().attr('href');
                  if (mag) {
                    item.magnet = mag;
                  } else {
                    const infoHash = $d('.infohash-box span').text().trim();
                    if (infoHash && infoHash.length >= 32) {
                      item.magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(item.title)}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce`;
                    }
                  }
                }
              } catch (e) {}
            }));

            const withMagnets = topCandidates.filter(t => t.magnet);
            if (withMagnets.length > 0) return withMagnets;
          }
        }
      }
      throw new Error('No 1337x results from ' + mirror);
    };

    try {
      return await Promise.any(mirrors.map(m => fetchMirror(m)));
    } catch (e) {
      // Fallback: Check TorrentSearchApi for 1337x
      try {
        const providerInstance = TorrentSearchApi.getProvider('1337x', false);
        if (providerInstance) {
          const searchPromise = providerInstance.search(cleanQuery, 'All', 20);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
          const results = await Promise.race([searchPromise, timeoutPromise]);
          if (Array.isArray(results) && results.length > 0) {
            const list = [];
            for (const t of results.slice(0, 5)) {
              let magnet = t.magnet;
              if (!magnet && t.desc) {
                try {
                  magnet = await Promise.race([
                    TorrentSearchApi.getMagnet(t),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                  ]);
                } catch (err) {}
              }
              if (magnet) {
                list.push({
                  title: t.title,
                  size: t.size || 'Unknown',
                  sizeBytes: parseSizeToBytes(t.size),
                  seeds: parseInt(t.seeds, 10) || 0,
                  leeches: parseInt(t.peers || t.leechs || 0, 10) || 0,
                  magnet,
                  provider: '1337x',
                  time: t.time
                });
              }
            }
            if (list.length > 0) return list;
          }
        }
      } catch (err) {}
      return [];
    }
  }

  async search1TamilMV(query) {
    try {
      const searchPromise = movieScraperService.searchTorrents(query);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('1TamilMV timeout')), 4500));
      const res = await Promise.race([searchPromise, timeoutPromise]);
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }

  async searchTorrentApi(query) {
    const [tpbResults, ytsResults, csvResults, x1337Results] = await Promise.allSettled([
      this.searchThePirateBay(query),
      this.searchYts(query),
      this.searchTorrentsCsv(query),
      this.search1337x(query)
    ]);

    const list = [
      ...(tpbResults.status === 'fulfilled' ? tpbResults.value : []),
      ...(ytsResults.status === 'fulfilled' ? ytsResults.value : []),
      ...(csvResults.status === 'fulfilled' ? csvResults.value : []),
      ...(x1337Results.status === 'fulfilled' ? x1337Results.value : [])
    ];

    return list;
  }

  async search(query, source = 'all') {
    try {
      let tpbResults = [];
      let ytsResults = [];
      let csvResults = [];
      let x1337Results = [];
      let mirrorResults = [];

      if (source === 'global') {
        const [tpbSettled, ytsSettled, csvSettled, x1337Settled] = await Promise.allSettled([
          this.searchThePirateBay(query),
          this.searchYts(query),
          this.searchTorrentsCsv(query),
          this.search1337x(query)
        ]);
        tpbResults = tpbSettled.status === 'fulfilled' ? (tpbSettled.value || []) : [];
        ytsResults = ytsSettled.status === 'fulfilled' ? (ytsSettled.value || []) : [];
        csvResults = csvSettled.status === 'fulfilled' ? (csvSettled.value || []) : [];
        x1337Results = x1337Settled.status === 'fulfilled' ? (x1337Settled.value || []) : [];
        console.log(`[SearchService:Global] Query "${query}" -> TPB: ${tpbResults.length}, YTS: ${ytsResults.length}, CSV: ${csvResults.length}, 1337x: ${x1337Results.length}`);
      } else if (source === '1tamilmv') {
        mirrorResults = await this.search1TamilMV(query);
        console.log(`[SearchService:1TamilMV] Query "${query}" -> Found: ${mirrorResults.length}`);
      } else {
        const [mirrorSettled, tpbSettled, ytsSettled, csvSettled, x1337Settled] = await Promise.allSettled([
          this.search1TamilMV(query),
          this.searchThePirateBay(query),
          this.searchYts(query),
          this.searchTorrentsCsv(query),
          this.search1337x(query)
        ]);

        mirrorResults = mirrorSettled.status === 'fulfilled' ? (mirrorSettled.value || []) : [];
        tpbResults = tpbSettled.status === 'fulfilled' ? (tpbSettled.value || []) : [];
        ytsResults = ytsSettled.status === 'fulfilled' ? (ytsSettled.value || []) : [];
        csvResults = csvSettled.status === 'fulfilled' ? (csvSettled.value || []) : [];
        x1337Results = x1337Settled.status === 'fulfilled' ? (x1337Settled.value || []) : [];
        console.log(`[SearchService:All] Query "${query}" -> TPB: ${tpbResults.length}, YTS: ${ytsResults.length}, CSV: ${csvResults.length}, 1337x: ${x1337Results.length}, 1TamilMV: ${mirrorResults.length}`);
      }

      const seenMagnets = new Set();
      const combined = [];

      // Interleave results to guarantee representation from all providers
      const maxLen = Math.max(tpbResults.length, ytsResults.length, csvResults.length, x1337Results.length, mirrorResults.length);
      const interleaved = [];
      for (let i = 0; i < maxLen; i++) {
        if (tpbResults[i]) interleaved.push(tpbResults[i]);
        if (csvResults[i]) interleaved.push(csvResults[i]);
        if (ytsResults[i]) interleaved.push(ytsResults[i]);
        if (x1337Results[i]) interleaved.push(x1337Results[i]);
        if (mirrorResults[i]) interleaved.push(mirrorResults[i]);
      }

      for (const item of interleaved) {
        if (!item.magnet) continue;
        const hashMatch = item.magnet.match(/urn:btih:([a-zA-Z0-9]+)/i);
        const dedupeKey = hashMatch ? hashMatch[1].toLowerCase() : item.magnet.toLowerCase();
        if (seenMagnets.has(dedupeKey)) continue;
        seenMagnets.add(dedupeKey);
        combined.push(item);
      }

      // Sort by seeds but ensure healthy representation of each provider
      return combined.sort((a, b) => (b.seeds || 0) - (a.seeds || 0)).slice(0, Math.max(config.maxResults || 25, 60));
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async searchWithDebug(query, source = 'all') {
    const debugInfo = { tpb: [] };
    const tpbResults = await this.searchThePirateBay(query, debugInfo.tpb);
    const results = await this.search(query, source);
    return { results, debugInfo, tpbCount: tpbResults.length };
  }
}

module.exports = new SearchService();
