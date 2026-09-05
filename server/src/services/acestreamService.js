const axios = require('axios');

class AceStreamService {
  constructor() {
    this.engineUrl = (process.env.ACESTREAM_ENGINE_URL || 'http://127.0.0.1:6878').replace(/\/+$/, '');
    this.timeout = 5000;
  }

  /**
   * Cleans and validates an Ace Stream Content ID
   * Supported formats:
   * - 40-character hex string (e.g. 78aa92a70ef16a0e450d861243cc7a90e23aca42)
   * - acestream://<id>
   * - infohash or content_id query param
   */
  sanitizeId(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Ace Stream ID is required');
    }

    let cleaned = input.trim();

    // Strip acestream:// protocol
    if (cleaned.startsWith('acestream://')) {
      cleaned = cleaned.replace(/^acestream:\/\//i, '').trim();
    }

    // Handle acestream://?content_id=... or id=...
    if (cleaned.includes('=')) {
      const match = cleaned.match(/(?:content_id|id|infohash)=([a-fA-F0-9]{40})/i);
      if (match) {
        cleaned = match[1];
      }
    }

    // Remove any query params or slashes
    cleaned = cleaned.split('?')[0].replace(/^\/+|\/+$/g, '');

    // Validate 40-character hex hash
    const hexRegex = /^[a-fA-F0-9]{40}$/;
    if (!hexRegex.test(cleaned)) {
      throw new Error('Invalid Ace Stream ID. Must be a 40-character hexadecimal string.');
    }

    return cleaned.toLowerCase();
  }

  /**
   * Checks whether the Ace Stream Engine is reachable
   */
  async checkEngineStatus() {
    try {
      // Ace Stream Engine exposes version check or HTTP status
      const res = await axios.get(`${this.engineUrl}/server/api?method=get_version`, {
        timeout: 2500,
        validateStatus: () => true
      });

      if (res.status >= 200 && res.status < 400) {
        return {
          online: true,
          engineUrl: this.engineUrl,
          version: res.data?.result?.version || 'Ready',
          timestamp: new Date().toISOString()
        };
      }

      // Fallback check root HTTP endpoint
      const pingRes = await axios.get(`${this.engineUrl}/`, {
        timeout: 2000,
        validateStatus: () => true
      });

      return {
        online: pingRes.status >= 200 && pingRes.status < 500,
        engineUrl: this.engineUrl,
        version: 'Active',
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        online: false,
        engineUrl: this.engineUrl,
        error: err.code === 'ECONNREFUSED' 
          ? `Engine offline at ${this.engineUrl}. Ensure Ace Stream Engine daemon or Docker is running.` 
          : err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get direct engine HLS manifest URL
   */
  getEngineHlsUrl(contentId) {
    const id = this.sanitizeId(contentId);
    return `${this.engineUrl}/ace/manifest.m3u8?id=${id}`;
  }

  /**
   * Get direct engine MPEG-TS stream URL
   */
  getEngineStreamUrl(contentId) {
    const id = this.sanitizeId(contentId);
    return `${this.engineUrl}/ace/getstream?id=${id}`;
  }

  /**
   * Generates M3U playlist file contents for external media players (VLC, IINA, MPV)
   */
  generateM3U(contentId, baseUrl, title = 'AceStream Live') {
    const id = this.sanitizeId(contentId);
    const safeTitle = title.replace(/[\r\n]/g, '').trim() || `AceStream-${id.substring(0, 8)}`;
    const streamUrl = `${baseUrl.replace(/\/+$/, '')}/api/acestream/stream?id=${id}`;

    return `#EXTM3U\n#EXTINF:-1 tvg-id="${id}" group-title="AceStream",${safeTitle}\n${streamUrl}\n`;
  }
}

module.exports = new AceStreamService();
