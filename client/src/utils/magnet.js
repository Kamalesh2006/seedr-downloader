/**
 * Utility functions for parsing magnet links and formatting file attributes
 */

/**
 * Extracts the display name (dn, name, or title) from a magnet URI, or generates a fallback name
 * @param {string} magnetUri - The magnet URI string
 * @returns {string} The extracted name or fallback
 */
export function extractMagnetName(magnetUri) {
  if (!magnetUri || typeof magnetUri !== 'string') return '';
  
  try {
    const trimmed = magnetUri.trim();
    // Check for dn, name, or title parameters
    const dnMatch = trimmed.match(/[?&](?:dn|name|title)=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      let raw = dnMatch[1].replace(/\+/g, ' ');
      try {
        raw = decodeURIComponent(raw);
      } catch (e) {
        try {
          raw = decodeURI(raw);
        } catch (e2) {
          raw = raw.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
      }
      return raw.trim() || 'Magnet Download';
    }

    // Fallback: extract hash from xt parameter
    const xtMatch = trimmed.match(/[?&]xt=urn:btih:([a-zA-Z0-9]+)/i);
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

/**
 * Ensures a magnet link is formatted as a full magnet URI
 * @param {string} magnet - Magnet URI or info hash
 * @param {string} [name] - Optional display name for dn parameter
 * @returns {string}
 */
export function ensureMagnetUri(magnet, name = '') {
  if (!magnet || typeof magnet !== 'string') return '';
  const trimmed = magnet.trim();
  if (trimmed.toLowerCase().startsWith('magnet:?')) {
    return trimmed;
  }
  if (trimmed.toLowerCase().startsWith('magnet:')) {
    return trimmed.replace(/^magnet:\??/i, 'magnet:?');
  }
  // Check if raw infohash (40 hex or 32 base32)
  if (/^[a-fA-F0-9]{40}$/.test(trimmed) || /^[a-zA-Z2-7]{32}$/.test(trimmed)) {
    const dnParam = name ? `&dn=${encodeURIComponent(name.trim())}` : '';
    return `magnet:?xt=urn:btih:${trimmed.toLowerCase()}${dnParam}`;
  }
  return trimmed;
}

/**
 * Normalizes title for consistent cross-system comparisons
 */
export function normalizeTitle(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().toLowerCase().replace(/[\s\.\-_\[\]\(\)\+]+/g, ' ');
}

/**
 * Extracts searchable, meaningful content tokens from movie/torrent titles
 */
export function cleanTitleTokens(str) {
  if (!str || typeof str !== 'string') return [];
  const clean = str
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.[a-z0-9\-_.]+/gi, ' ')
    .replace(/1tamilmv|tamilmv|tamilblasters|yts|tgx|rarbg|eztv|torrentgalaxy|psa|galaxytv/gi, ' ')
    .replace(/1080p|720p|2160p|4k|hevc|x264|x265|h264|h265|web-dl|webrip|bluray|hdrip|dvdrip|untouched|unrated|hq|avc|ddp5\.1|ddp5|dd5\.1|esub|complete/gi, ' ')
    .replace(/hindi|tamil|telugu|malayalam|kannada|english|dual audio|multi audio|clean/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  return clean.split(/\s+/).filter(t => t.length >= 2);
}

/**
 * Determines if a queued item is already present in Cloud Storage (completed files, active torrents, or tasks)
 */
export function isItemInCloud(queueItem, completedFiles = [], cloudTorrents = [], cloudTasks = []) {
  if (!queueItem) return false;
  const qHash = extractMagnetHash(queueItem.magnet);
  const qName = queueItem.name || extractMagnetName(queueItem.magnet) || '';
  const normQ = normalizeTitle(qName);
  const qTokens = cleanTitleTokens(qName);

  // 1. Check active downloading cloud torrents
  if (Array.isArray(cloudTorrents)) {
    for (const t of cloudTorrents) {
      const tHash = (t.torrent_hash || t.hash || '').toLowerCase();
      if (qHash && tHash && qHash === tHash) return true;
      const normT = normalizeTitle(t.name || t.title || '');
      if (normQ && normT && normQ === normT) return true;
    }
  }

  // 2. Check active cloud tasks
  if (Array.isArray(cloudTasks)) {
    for (const task of cloudTasks) {
      const normTask = normalizeTitle(task.name || task.title || '');
      if (normQ && normTask && normQ === normTask) return true;
    }
  }

  // 3. Check completed files and folders
  if (Array.isArray(completedFiles)) {
    for (const f of completedFiles) {
      const fName = f.name || f.path || f.title || '';
      const normF = normalizeTitle(fName);

      // Exact normalized name match
      if (normQ && normF && normQ === normF) return true;

      // Substring match if sufficiently descriptive
      if (normQ.length >= 15 && normF.length >= 15) {
        if (normQ.includes(normF) || normF.includes(normQ)) return true;
      }

      // Token overlap match
      if (qTokens.length >= 2) {
        const fTokens = cleanTitleTokens(fName);
        if (fTokens.length >= 2) {
          let matches = 0;
          for (const tok of qTokens) {
            if (fTokens.includes(tok)) matches++;
          }
          const overlap = matches / Math.min(qTokens.length, fTokens.length);
          if (overlap >= 0.8 && matches >= 2) return true;
        }
      }
    }
  }

  return false;
}

