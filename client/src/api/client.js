import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(
  (config) => {
    try {
      const isGuestMode = localStorage.getItem('seedr_user_mode') === 'guest';
      const token = localStorage.getItem('seedr_auth_token');

      if (isGuestMode) {
        config.headers['x-guest-mode'] = 'true';
      } else if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore localStorage read errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Returns a stream/download URL with an auth token query parameter appended
 * when an authenticated personal account is active.
 */
export function getStreamUrl(endpoint) {
  if (!endpoint) return '';
  try {
    const isGuestMode = localStorage.getItem('seedr_user_mode') === 'guest';
    const token = localStorage.getItem('seedr_auth_token');
    if (!isGuestMode && token) {
      const separator = endpoint.includes('?') ? '&' : '?';
      return `${endpoint}${separator}token=${encodeURIComponent(token)}`;
    }
  } catch (e) {}
  return endpoint;
}

export default api;
