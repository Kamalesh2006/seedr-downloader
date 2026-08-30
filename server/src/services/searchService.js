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

class SearchService {
  constructor() {
    this.maxFileSizeGB = parseFloat(process.env.MAX_FILE_SIZE_GB || config.maxFileSizeGB);
    this.maxFileSizeBytes = this.maxFileSizeGB * 1024 * 1024 * 1024;
  }

  async search(query) {
    try {
      const allResults = [];

      for (const provider of config.searchProviders) {
        console.log(`Searching provider: ${provider.name}`);
        let providerResults = [];
        let success = false;

        const urls = provider.urls && provider.urls.length > 0 ? provider.urls : [provider.baseUrl];

        for (const url of urls) {
          try {
            console.log(`Trying mirror for ${provider.name}: ${url}`);
            
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
              console.log(`Success on ${provider.name} with mirror ${url}. Found ${results.length} results.`);
              providerResults = results;
              success = true;
              break; // Mirror succeeded, stop trying mirrors for this provider
            }
          } catch (error) {
            console.error(`Mirror failed or timed out: ${url} for ${provider.name}. Error: ${error.message}`);
          }
        }

        if (success && providerResults.length > 0) {
          for (const torrent of providerResults) {
            const sizeBytes = parseSizeToBytes(torrent.size);
            
            if (sizeBytes > 0 && sizeBytes <= this.maxFileSizeBytes) {
              try {
                // Get magnet link
                const magnet = await TorrentSearchApi.getMagnet(torrent);
                
                if (magnet) {
                  allResults.push({
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
                console.error(`Error getting magnet for ${torrent.title}:`, magnetError.message);
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

      // Sort by seeds descending and return up to maxResults
      return allResults.sort((a, b) => b.seeds - a.seeds).slice(0, config.maxResults);
      
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
}

module.exports = new SearchService();
