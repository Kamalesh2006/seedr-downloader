const TorrentSearchApi = require('torrent-search-api');
const axios = require('axios');
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

    for (const mirror of mirrors) {
      try {
        const cleanMirror = mirror.replace(/\/+$/, '');
        const url = `${cleanMirror}/api/v2/list_movies.json?query_term=${encodeURIComponent(query.trim())}&sort=seeds&order=desc`;
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          },
          timeout: 4500
        });

        if (res.data?.data?.movies && Array.isArray(res.data.data.movies)) {
          const results = [];
          for (const movie of res.data.data.movies) {
            if (!movie.torrents) continue;
            for (const t of movie.torrents) {
              if (!t.hash) continue;
              const title = `${movie.title} (${movie.year}) [${t.quality || 'HD'}] [${(t.type || 'WEB').toUpperCase()}] [YTS.MX]`;
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
      } catch (err) {
        // Continue to next mirror
      }
    }
    return [];
  }

  async searchThePirateBay(query) {
    const tpbCfg = (config.searchProviders || []).find(p => p.name.toLowerCase() === 'thepiratebay') || {};
    const mirrors = (tpbCfg.urls && tpbCfg.urls.length > 0)
      ? tpbCfg.urls
      : ['https://apibay.org', 'https://piratebayproxy.info/api.php?url='];

    for (const mirror of mirrors) {
      try {
        const cleanMirror = mirror.replace(/\/+$/, '');
        let url;
        if (cleanMirror.includes('api.php')) {
          url = `${cleanMirror}${encodeURIComponent('/q.php?q=' + query.trim())}`;
        } else {
          url = `${cleanMirror}/q.php?q=${encodeURIComponent(query.trim())}`;
        }

        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          },
          timeout: 6000
        });

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

            const magnet = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce`;

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
          if (results.length > 0) return results;
        }
      } catch (err) {
        // Continue to next mirror
      }
    }

    // Fallback to TorrentSearchApi for ThePirateBay if direct apibay failed
    try {
      const providerInstance = TorrentSearchApi.getProvider('ThePirateBay', false);
      if (providerInstance) {
        const searchPromise = providerInstance.search(query, 'All', Math.max(config.maxResults || 25, 40));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000));
        const results = await Promise.race([searchPromise, timeoutPromise]);
        if (Array.isArray(results)) {
          return results.filter(t => t.magnet || (t.link && t.link.startsWith('magnet:?'))).map(t => ({
            title: t.title,
            size: t.size || 'Unknown',
            sizeBytes: parseSizeToBytes(t.size),
            seeds: parseInt(t.seeds, 10) || 0,
            leeches: parseInt(t.peers || t.leechs || 0, 10) || 0,
            magnet: t.magnet || t.link,
            provider: 'ThePirateBay',
            time: t.time
          }));
        }
      }
    } catch (e) {}

    return [];
  }

  async search1337x(query) {
    try {
      const providerInstance = TorrentSearchApi.getProvider('1337x', false);
      if (!providerInstance) return [];

      const pCfg = (config.searchProviders || []).find(p => p.name === '1337x');
      const urls = pCfg?.urls?.length ? pCfg.urls : [providerInstance.baseUrl];

      for (const url of urls) {
        try {
          if (url) providerInstance.overrideConfig({ baseUrl: url });
          const searchPromise = providerInstance.search(query, 'All', 20);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000));
          const results = await Promise.race([searchPromise, timeoutPromise]);
          if (Array.isArray(results) && results.length > 0) {
            const list = [];
            for (const t of results.slice(0, 15)) {
              let magnet = t.magnet;
              if (!magnet && t.desc) {
                try {
                  const magPromise = TorrentSearchApi.getMagnet(t);
                  const magTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
                  magnet = await Promise.race([magPromise, magTimeout]);
                } catch (err) {}
              }
              if (magnet) {
                const sizeBytes = parseSizeToBytes(t.size);
                list.push({
                  title: t.title,
                  size: t.size || 'Unknown',
                  sizeBytes,
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
        } catch (e) {}
      }
    } catch (err) {}
    return [];
  }

  async searchTorrentApi(query) {
    const [tpbResults, ytsResults, x1337Results] = await Promise.allSettled([
      this.searchThePirateBay(query),
      this.searchYts(query),
      this.search1337x(query)
    ]);

    const list = [
      ...(tpbResults.status === 'fulfilled' ? tpbResults.value : []),
      ...(ytsResults.status === 'fulfilled' ? ytsResults.value : []),
      ...(x1337Results.status === 'fulfilled' ? x1337Results.value : [])
    ];

    return list;
  }

  async search(query) {
    try {
      const [mirrorSettled, tpbSettled, ytsSettled, x1337Settled] = await Promise.allSettled([
        movieScraperService.searchTorrents(query),
        this.searchThePirateBay(query),
        this.searchYts(query),
        this.search1337x(query)
      ]);

      const mirrorResults = mirrorSettled.status === 'fulfilled' ? (mirrorSettled.value || []) : [];
      const tpbResults = tpbSettled.status === 'fulfilled' ? (tpbSettled.value || []) : [];
      const ytsResults = ytsSettled.status === 'fulfilled' ? (ytsSettled.value || []) : [];
      const x1337Results = x1337Settled.status === 'fulfilled' ? (x1337Settled.value || []) : [];

      console.log(`[SearchService] Query "${query}" -> Found: TPB: ${tpbResults.length}, YTS: ${ytsResults.length}, 1337x: ${x1337Results.length}, 1TamilMV: ${mirrorResults.length}`);

      const seenMagnets = new Set();
      const combined = [];

      for (const item of [...tpbResults, ...ytsResults, ...x1337Results, ...mirrorResults]) {
        if (!item.magnet) continue;
        const hashMatch = item.magnet.match(/urn:btih:([a-zA-Z0-9]+)/i);
        const dedupeKey = hashMatch ? hashMatch[1].toLowerCase() : item.magnet.toLowerCase();
        if (seenMagnets.has(dedupeKey)) continue;
        seenMagnets.add(dedupeKey);
        combined.push(item);
      }

      return combined.sort((a, b) => (b.seeds || 0) - (a.seeds || 0)).slice(0, Math.max(config.maxResults || 25, 50));
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
}

module.exports = new SearchService();
