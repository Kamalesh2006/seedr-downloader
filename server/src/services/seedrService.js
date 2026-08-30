const axios = require('axios');
const config = require('../../config.json');

class SeedrService {
  constructor() {
    this.email = process.env.SEEDR_EMAIL;
    this.password = process.env.SEEDR_PASSWORD;
    this.baseUrl = config.seedrBaseUrl;
  }

  get auth() {
    return {
      username: this.email,
      password: this.password
    };
  }

  async addMagnet(magnetLink) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer/magnet`,
        `magnet=${encodeURIComponent(magnetLink)}`,
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async getTransferStatus(transferId) {
    try {
      const response = await axios.get(`${this.baseUrl}/transfer/${transferId}`, {
        auth: this.auth
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async listFolder(folderId = null) {
    try {
      const url = folderId ? `${this.baseUrl}/folder/${folderId}` : `${this.baseUrl}/folder`;
      const response = await axios.get(url, {
        auth: this.auth
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async getDownloadUrl(fileId) {
    try {
      // Don't follow redirects, capture the Location header
      const response = await axios.get(`${this.baseUrl}/file/${fileId}`, {
        auth: this.auth,
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      if (response.status === 301 || response.status === 302) {
        return { url: response.headers.location };
      } else {
        throw new Error('Failed to get download URL, redirect not found');
      }
    } catch (error) {
      if (error.response && (error.response.status === 301 || error.response.status === 302)) {
         return { url: error.response.headers.location };
      }
      throw error.response ? error.response.data : error;
    }
  }

  async deleteFile(fileId) {
    try {
      const response = await axios.delete(`${this.baseUrl}/file/${fileId}`, {
        auth: this.auth
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  async deleteFolder(folderId) {
    try {
      const response = await axios.delete(`${this.baseUrl}/folder/${folderId}`, {
        auth: this.auth
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }
}

module.exports = new SeedrService();
