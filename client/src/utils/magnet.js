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
 * Alias for extractMagnetName
 */
export function getMagnetDisplayName(magnetUri) {
  return extractMagnetName(magnetUri);
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
  return str.trim().toLowerCase().startsWith('magnet:?');
}

/**
 * Parse human readable size string or byte number into size in Gigabytes (GB)
 * @param {string|number} sizeStr
 * @returns {number} Size in GB
 */
export function parseSizeInGB(sizeStr) {
  if (!sizeStr) return 0;
  if (typeof sizeStr === 'number') {
    return sizeStr / (1024 * 1024 * 1024);
  }
  const match = String(sizeStr).match(/([\d.]+)\s*(GB|MB|KB|B)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return val;
  if (unit === 'MB') return val / 1024;
  if (unit === 'KB') return val / (1024 * 1024);
  if (unit === 'B') return val / (1024 * 1024 * 1024);
  return val;
}

/**
 * Check if a file size exceeds Seedr maximum capacity limit (4.5 GB)
 * @param {string|number} sizeStr
 * @param {number} limitGB
 * @returns {boolean}
 */
export function isOversizedForSeedr(sizeStr, limitGB = 4.5) {
  const gb = parseSizeInGB(sizeStr);
  return gb > limitGB;
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB, TB)
 * @param {number} bytes - Byte count
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || isNaN(bytes) || Number(bytes) === 0) return '0 B';
  const numBytes = Number(bytes);
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((numBytes / Math.pow(k, clampedIndex)).toFixed(dm))} ${sizes[clampedIndex]}`;
}

/**
 * Formats a timestamp into a relative time string (e.g. "Today", "Yesterday", "3d ago", "May 12")
 * @param {number|string|Date} timestamp - The timestamp to format
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Today';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Today';
    const now = new Date();
    
    // Check same calendar day
    const isToday = date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    if (isToday) return 'Today';

    // Check yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return 'Yesterday';

    const diffInSeconds = Math.floor((now - date) / 1000);
    const diffInDays = Math.floor(diffInSeconds / (3600 * 24));
    
    if (diffInDays < 7 && diffInDays > 0) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Today';
  }
}

