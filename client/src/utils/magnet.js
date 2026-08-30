/**
 * Utility functions for parsing magnet links and formatting file attributes
 */

/**
 * Extracts the display name (dn) from a magnet URI, or generates a fallback name
 * @param {string} magnetUri - The magnet URI string
 * @returns {string} The extracted name or fallback
 */
export function extractMagnetName(magnetUri) {
  if (!magnetUri || typeof magnetUri !== 'string') return '';
  
  try {
    // Check for dn parameter: dn=Name+Of+File or dn=Name%20Of%20File
    const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      const decoded = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
      return decoded.trim();
    }

    // Fallback: extract hash from xt parameter
    const xtMatch = magnetUri.match(/[?&]xt=urn:btih:([a-zA-Z0-9]+)/i);
    if (xtMatch && xtMatch[1]) {
      const hash = xtMatch[1];
      return `Torrent-${hash.substring(0, 8)}...`;
    }
  } catch (e) {
    console.error('Failed to parse magnet display name', e);
  }

  return 'Magnet Download';
}

/**
 * Extracts the BTIH info hash from a magnet URI
 * @param {string} magnetUri - The magnet URI string
 * @returns {string|null} The hash or null
 */
export function extractMagnetHash(magnetUri) {
  if (!magnetUri || typeof magnetUri !== 'string') return null;
  const match = magnetUri.match(/[?&]xt=urn:btih:([a-zA-Z0-9]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Checks if a string is a valid magnet URI
 * @param {string} str - String to test
 * @returns {boolean}
 */
export function isValidMagnet(str) {
  if (!str || typeof str !== 'string') return false;
  return str.trim().startsWith('magnet:?');
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB, TB)
 * @param {number} bytes - Byte count
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'B'}`;
}

/**
 * Formats a timestamp into a relative time string (e.g. "5m ago", "2h ago")
 * @param {number|string|Date} timestamp - The timestamp to format
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
