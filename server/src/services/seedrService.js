const axios = require('axios');
const config = require('../../config.json');

class SeedrService {
  constructor(options = {}) {
    // If accessToken is provided, this is a user-scoped instance
    this.accessToken = options.accessToken || null;
    this.refreshToken = options.refreshToken || null;
    this.tokenExpiresAt = options.tokenExpiresAt || 0;

    // Fallback credentials for default/guest service
    this.email = options.email !== undefined ? options.email : process.env.SEEDR_EMAIL;
    this.password = options.password !== undefined ? options.password : process.env.SEEDR_PASSWORD;

    this.baseUrl = config.seedrBaseUrl || 'https://www.seedr.cc/rest';
    this.tokenUrl = 'https://www.seedr.cc/oauth_test/token.php';
    this.deviceCodeUrl = 'https://www.seedr.cc/oauth_test/device_code.php';
    this.devicePollUrl = 'https://www.seedr.cc/oauth_test/device.php';
    this.fileMetadataCache = new Map();
  }

  static async loginWithCredentials(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', 'seedr_chrome');
    params.append('username', email);
    params.append('password', password);

    const response = await axios.post('https://www.seedr.cc/oauth_test/token.php', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  }

  static async getDeviceCode() {
    const params = new URLSearchParams();
    params.append('client_id', 'seedr_chrome');

    const response = await axios.post('https://www.seedr.cc/oauth_test/device_code.php', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  }

  static async pollDeviceCode(deviceCode) {
    if (!deviceCode) {
      throw new Error('device_code is required');
    }

    const response = await axios.get(`https://www.seedr.cc/oauth_test/device.php?client_id=seedr_chrome&device_code=${encodeURIComponent(deviceCode)}`);
    return response.data;
  }

  async getAccessToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.accessToken && (this.tokenExpiresAt === 0 || this.tokenExpiresAt > now + 60000)) {
      return this.accessToken;
    }

    // Try refreshing if refresh_token is available
    if (this.refreshToken) {
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', 'seedr_chrome');
        params.append('refresh_token', this.refreshToken);

        const response = await axios.post(this.tokenUrl, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (response.data && response.data.access_token) {
          this.accessToken = response.data.access_token;
          if (response.data.refresh_token) {
            this.refreshToken = response.data.refresh_token;
          }
          const expiresIn = response.data.expires_in || 2592000;
          this.tokenExpiresAt = now + expiresIn * 1000;
          return this.accessToken;
        }
      } catch (err) {
        console.warn('Seedr refresh token exchange failed:', err.response?.data || err.message);
      }
    }

    // Fall back to password credentials if available (e.g. for default/guest account)
    if (this.email && this.password) {
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('client_id', 'seedr_chrome');
        params.append('username', this.email);
        params.append('password', this.password);

        const response = await axios.post(this.tokenUrl, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (response.data && response.data.access_token) {
          this.accessToken = response.data.access_token;
          const expiresIn = response.data.expires_in || 2592000; // default 30 days
          this.tokenExpiresAt = now + expiresIn * 1000;
          return this.accessToken;
        } else {
          throw new Error('No access_token returned from Seedr authentication');
        }
      } catch (error) {
        console.error('Seedr OAuth token error:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : error;
      }
    }

    if (this.accessToken) {
      return this.accessToken;
    }

    throw new Error('No valid Seedr credentials or access token available');
  }

  async makeRequest(method, url, data = null, headers = {}, isRetry = false) {
    try {
      const token = await this.getAccessToken(isRetry);
      const reqHeaders = {
        ...headers,
        Authorization: `Bearer ${token}`
      };

      const response = await axios({
        method,
        url,
        data,
        headers: reqHeaders,
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

      return response;
    } catch (error) {
      if (!isRetry && error.response && (error.response.status === 401 || error.response.data?.error === 'access_denied')) {
        // Token might have expired, refresh and retry once if possible
        this.accessToken = null;
        return this.makeRequest(method, url, data, headers, true);
      }
      throw error;
    }
  }

  async getSettings() {
    try {
      const response = await this.makeRequest('get', `${this.baseUrl}/settings`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async addMagnet(magnetLink) {
    try {
      const response = await this.makeRequest(
        'post',
        `${this.baseUrl}/transfer/magnet`,
        `magnet=${encodeURIComponent(magnetLink)}`,
        { 'Content-Type': 'application/x-www-form-urlencoded' }
      );
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async getTransferStatus(transferId) {
    try {
      const response = await this.makeRequest(
        'get',
        `${this.baseUrl}/transfer/${transferId}`
      );
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async listFolder(folderId = null) {
    try {
      const url = folderId ? `${this.baseUrl}/folder/${folderId}` : `${this.baseUrl}/folder`;
      const response = await this.makeRequest('get', url);
      const data = response.data || {};

      // Normalize folder and file names (Seedr uses path/name interchangeably)
      const folders = (data.folders || []).map(f => ({
        ...f,
        id: f.id,
        name: f.name || f.path || f.fullname || 'Folder',
        size: f.size || 0
      }));

      const files = (data.files || []).map(f => {
        const isVideo = !!f.is_video || !!(f.name && f.name.match(/\.(mp4|mkv|avi|webm|mov|m4v|flv)$/i));
        const isAudio = !!f.is_audio || !!(f.name && f.name.match(/\.(mp3|wav|flac|aac|m4a|ogg)$/i));
        const hlsUrl = f.presentation_urls?.video?.hls || null;

        return {
          ...f,
          id: f.id || f.folder_file_id,
          name: f.name || f.path || f.fullname || 'File',
          size: f.size || 0,
          isVideo,
          isAudio,
          hlsUrl,
          thumb: f.thumb || null,
          presentation_urls: f.presentation_urls || null
        };
      });

      // Cache file info for fast stream info resolution
      for (const f of files) {
        this.fileMetadataCache.set(String(f.id), {
          id: f.id,
          name: f.name,
          size: f.size,
          isVideo: f.isVideo,
          isAudio: f.isAudio,
          hlsUrl: f.hlsUrl,
          thumb: f.thumb,
          parentFolderId: folderId,
          cachedAt: Date.now()
        });
      }

      const torrents = (data.torrents || []).map(t => ({
        ...t,
        id: t.id,
        name: t.name || t.path || t.title || 'Torrent Transfer',
        size: t.size || 0,
        progress: typeof t.progress === 'number' ? t.progress : 0,
        status: t.stopped ? 'Stopped' : (t.progress >= 100 ? 'Completed' : 'Downloading'),
        type: 'torrent'
      }));

      const tasks = (data.tasks || []).map(t => ({
        ...t,
        id: t.id,
        name: t.name || t.title || 'Processing Task',
        size: t.size || 0,
        type: 'task'
      }));

      return {
        ...data,
        folders,
        files,
        torrents,
        tasks,
        space_used: data.space_used !== undefined ? data.space_used : data.size || 0,
        space_max: data.space_max !== undefined ? data.space_max : 4831838208
      };
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async getDownloadUrl(fileId) {
    try {
      const response = await this.makeRequest('get', `${this.baseUrl}/file/${fileId}`);
      
      // Seedr JSON response with url
      if (response.data && response.data.url) {
        return { 
          url: response.data.url, 
          name: response.data.name || 'download' 
        };
      }
      
      // Seedr redirect response
      if (response.status === 301 || response.status === 302) {
        return { url: response.headers.location };
      }

      throw new Error('Failed to get download URL from Seedr response');
    } catch (error) {
      if (error.response && (error.response.status === 301 || error.response.status === 302)) {
        return { url: error.response.headers.location };
      }
      throw error.response ? error.response.data : error;
    }
  }

  async getFileStreamInfo(fileId) {
    const sId = String(fileId);
    let downloadResult = null;
    try {
      downloadResult = await this.getDownloadUrl(fileId);
    } catch (e) {
      console.warn(`Could not get download URL for file ${fileId}:`, e.message);
    }

    let meta = this.fileMetadataCache.get(sId);
    // If not cached or cached without hlsUrl, refresh folders
    if (!meta || (!meta.hlsUrl && Date.now() - (meta.cachedAt || 0) > 10000)) {
      try {
        const rootData = await this.listFolder();
        meta = this.fileMetadataCache.get(sId);
        if (!meta && rootData.folders && rootData.folders.length > 0) {
          for (const folder of rootData.folders) {
            await this.listFolder(folder.id);
            meta = this.fileMetadataCache.get(sId);
            if (meta) break;
          }
        }
      } catch (err) {
        console.warn(`Failed searching folders for stream info ${fileId}:`, err.message);
      }
    }

    const fileName = meta?.name || downloadResult?.name || 'File';
    const isVideo = meta?.isVideo !== undefined ? meta.isVideo : !!fileName.match(/\.(mp4|mkv|avi|webm|mov|m4v|flv)$/i);
    const isAudio = meta?.isAudio !== undefined ? meta.isAudio : !!fileName.match(/\.(mp3|wav|flac|aac|m4a|ogg)$/i);

    return {
      id: fileId,
      name: fileName,
      size: meta?.size || 0,
      downloadUrl: downloadResult?.url || null,
      hlsUrl: meta?.hlsUrl || null,
      isVideo,
      isAudio,
      thumb: meta?.thumb || null
    };
  }

  async deleteFile(fileId) {
    try {
      const response = await this.makeRequest('delete', `${this.baseUrl}/file/${fileId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async deleteFolder(folderId) {
    try {
      const response = await this.makeRequest('delete', `${this.baseUrl}/folder/${folderId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async deleteTorrent(torrentId) {
    try {
      const response = await this.makeRequest('delete', `${this.baseUrl}/torrent/${torrentId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async deleteTask(taskId) {
    try {
      const response = await this.makeRequest('delete', `${this.baseUrl}/task/${taskId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }
}

const defaultSeedrService = new SeedrService();

module.exports = defaultSeedrService;
module.exports.SeedrService = SeedrService;
module.exports.createUserSeedrService = (options) => {
  if (typeof options === 'string') {
    return new SeedrService({ accessToken: options });
  }
  return new SeedrService(options || {});
};
