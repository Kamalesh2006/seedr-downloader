const axios = require('axios');
const config = require('../../config.json');

class SeedrService {
  constructor() {
    this.email = process.env.SEEDR_EMAIL;
    this.password = process.env.SEEDR_PASSWORD;
    this.baseUrl = config.seedrBaseUrl || 'https://www.seedr.cc/rest';
    this.tokenUrl = 'https://www.seedr.cc/oauth_test/token.php';
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  async getAccessToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken;
    }

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
        // Token might have expired, refresh and retry once
        this.accessToken = null;
        return this.makeRequest(method, url, data, headers, true);
      }
      throw error;
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

      const files = (data.files || []).map(f => ({
        ...f,
        id: f.id || f.folder_file_id,
        name: f.name || f.path || f.fullname || 'File',
        size: f.size || 0
      }));

      return {
        ...data,
        folders,
        files,
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
}

module.exports = new SeedrService();
