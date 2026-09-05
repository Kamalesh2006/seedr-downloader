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
    for (const provider of config.searchProviders) {
      console.log(`Searching provider: ${provider.name}`);
      let providerResults = [];
      let success = false;

      const urls = provider.urls && provider.urls.length > 0 ? provider.urls : [provider.baseUrl];

      for (const url of urls) {
        try {
          // Disable other providers to search only this one
          TorrentSearchApi.disableAllProviders();
          TorrentSearchApi.enableProvider(provider.name);
          TorrentSearchApi.overrideConfig(provider.name, { baseUrl: url });

          // Enforce a 6-second timeout using Promise.race
          const searchPromise = TorrentSearchApi.search(query, 'All', config.maxResults);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 6000)
          );
          
          const results = await Promise.race([searchPromise, timeoutPromise]);
          
          if (results && results.length > 0) {
            providerResults = results;
            success = true;
            break;
          }
        } catch (error) {
          // Continue to next mirror
        }
      }

      if (success && providerResults.length > 0) {
        for (const torrent of providerResults) {
          const sizeBytes = parseSizeToBytes(torrent.size);
          
          if (sizeBytes > 0 && sizeBytes <= this.maxFileSizeBytes) {
            try {
              const magnet = await TorrentSearchApi.getMagnet(torrent);
              if (magnet) {
                apiResults.push({
                  title: torrent.title,
                  size: torrent.size,
                  sizeBytes: sizeBytes,
                  seeds: parseInt(torrent.seeds) || 0,
                  leeches: parseInt(torrent.peers || torrent.leechs || 0),
                  magnet: magnet,
                  provider: torrent.provider || provider.name,
                  time: torrent.time
                });
              }
            } catch (magnetError) {
              // Ignore magnet fetch error
            }
          }
        }
      }
    }

    // Re-enable all providers when finished
    TorrentSearchApi.disableAllProviders();
    for (const provider of config.searchProviders) {
      try {
        TorrentSearchApi.enableProvider(provider.name);
      } catch (e) {}
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

      // Sort by seeds descending and return up to maxResults
      return combined.sort((a, b) => (b.seeds || 0) - (a.seeds || 0)).slice(0, Math.max(config.maxResults || 25, 30));
      
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
}

module.exports = new SearchService();
