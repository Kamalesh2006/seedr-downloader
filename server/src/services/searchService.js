const TorrentSearchApi = require('torrent-search-api');
const config = require('../../config.json');

// Initially enable all providers with default settings
for (const provider of config.searchProviders) {
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

const movieScraperService = require('./movieScraperService');

class SearchService {
  constructor() {
    this.maxFileSizeGB = parseFloat(process.env.MAX_FILE_SIZE_GB || config.maxFileSizeGB);
    this.maxFileSizeBytes = this.maxFileSizeGB * 1024 * 1024 * 1024;
  }

  async searchTorrentApi(query) {
    const apiResults = [];
    const providers = config.searchProviders || [];

    const providerPromises = providers.map(async (providerCfg) => {
      const providerName = providerCfg.name;
      const providerInstance = TorrentSearchApi.getProvider(providerName, false);
      if (!providerInstance) return [];

      const urls = providerCfg.urls && providerCfg.urls.length > 0 ? providerCfg.urls : [providerInstance.baseUrl];

      for (const url of urls) {
        try {
          if (url) {
            providerInstance.overrideConfig({ baseUrl: url });
          }
          const searchPromise = providerInstance.search(query, 'All', Math.max(config.maxResults || 25, 40));
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 4000)
          );
          const results = await Promise.race([searchPromise, timeoutPromise]);
          if (results && results.length > 0) {
            return results;
          }
        } catch (e) {
          // Continue to next mirror/url
        }
      }
      return [];
    });

    const settled = await Promise.allSettled(providerPromises);

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        for (const torrent of res.value) {
          const sizeBytes = parseSizeToBytes(torrent.size);
          let magnet = torrent.magnet;
          
          if (!magnet && torrent.link && torrent.link.startsWith('magnet:?')) {
            magnet = torrent.link;
          }

          if (magnet) {
            apiResults.push({
              title: torrent.title,
              size: torrent.size || (sizeBytes ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown'),
              sizeBytes: sizeBytes || 0,
              seeds: parseInt(torrent.seeds) || 0,
              leeches: parseInt(torrent.peers || torrent.leechs || 0),
              magnet: magnet,
              provider: torrent.provider || 'Public Torrent',
              time: torrent.time
            });
          }
        }
      }
    }

    return apiResults;
  }

  async search(query) {
    try {
      // Execute 1TamilMV mirror search and TorrentSearchApi in parallel
      const [mirrorSettled, torrentApiSettled] = await Promise.allSettled([
        movieScraperService.searchTorrents(query),
        this.searchTorrentApi(query)
      ]);

      const mirrorResults = mirrorSettled.status === 'fulfilled' ? (mirrorSettled.value || []) : [];
      const apiResults = torrentApiSettled.status === 'fulfilled' ? (torrentApiSettled.value || []) : [];

      console.log(`[SearchService] Query "${query}" -> Found ${mirrorResults.length} from 1TamilMV, ${apiResults.length} from TorrentSearchApi`);

      // Combine results, prioritizing deduplication by infoHash / magnet
      const seenMagnets = new Set();
      const combined = [];

      for (const item of [...mirrorResults, ...apiResults]) {
        if (!item.magnet || seenMagnets.has(item.magnet)) continue;
        seenMagnets.add(item.magnet);
        combined.push(item);
      }

      // Sort by seeds descending and return up to 50 results
      return combined.sort((a, b) => (b.seeds || 0) - (a.seeds || 0)).slice(0, Math.max(config.maxResults || 25, 50));
      
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
}

module.exports = new SearchService();
