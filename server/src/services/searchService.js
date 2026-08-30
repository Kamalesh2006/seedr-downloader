const TorrentSearchApi = require('torrent-search-api');
const config = require('../../config.json');

// Initialize providers
for (const provider of config.searchProviders) {
  try {
    TorrentSearchApi.enableProvider(provider);
  } catch (error) {
    console.error(`Failed to enable provider ${provider}:`, error.message);
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
      const results = await TorrentSearchApi.search(query, 'All', config.maxResults * 2); // Fetch extra for filtering
      
      const processedResults = [];
      
      for (const torrent of results) {
        const sizeBytes = parseSizeToBytes(torrent.size);
        
        if (sizeBytes > 0 && sizeBytes <= this.maxFileSizeBytes) {
          try {
            // Get magnet link
            const magnet = await TorrentSearchApi.getMagnet(torrent);
            
            if (magnet) {
              processedResults.push({
                title: torrent.title,
                size: torrent.size,
                sizeBytes: sizeBytes,
                seeds: torrent.seeds,
                leeches: torrent.peers,
                magnet: magnet,
                provider: torrent.provider,
                time: torrent.time
              });
            }
          } catch (magnetError) {
             console.error(`Error getting magnet for ${torrent.title}:`, magnetError.message);
          }
        }
        
        if (processedResults.length >= config.maxResults) {
          break;
        }
      }
      
      // Sort by seeds descending
      return processedResults.sort((a, b) => b.seeds - a.seeds);
      
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
}

module.exports = new SearchService();
