/**
 * VLC Media Player Integration Utilities
 * Supports launching VLC on iOS, Android, macOS, Windows, and Linux,
 * as well as generating M3U stream playlists and clipboard copy helpers.
 */

export function getDeviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  const isWindows = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  return {
    isIOS,
    isAndroid,
    isMobile,
    isMac,
    isWindows,
    isLinux,
    osName: isIOS ? 'iOS' : isAndroid ? 'Android' : isMac ? 'macOS' : isWindows ? 'Windows' : isLinux ? 'Linux' : 'Device'
  };
}

/**
 * Attempts to launch VLC media player with the direct video/media stream URL
 * @param {string} streamUrl Direct HTTP/HTTPS stream URL
 * @param {string} fileName Optional filename
 */
export function openInVLC(streamUrl, fileName = 'video') {
  if (!streamUrl) return false;

  const device = getDeviceInfo();

  if (device.isIOS) {
    // iOS VLC custom x-callback scheme or direct vlc:// scheme
    const encoded = encodeURIComponent(streamUrl);
    const vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encoded}`;
    
    // Attempt x-callback, fallback to vlc://
    window.location.href = vlcUrl;
    setTimeout(() => {
      window.location.href = `vlc://${streamUrl}`;
    }, 500);
    return true;
  }

  if (device.isAndroid) {
    // Android Intent to target VLC media player app
    const scheme = streamUrl.startsWith('https') ? 'https' : 'http';
    const noScheme = streamUrl.replace(/^https?:\/\//, '');
    const intentUrl = `intent://${noScheme}#Intent;package=org.videolan.vlc;type=video/*;scheme=${scheme};end`;

    // Attempt Android Intent first, fallback to vlc://
    window.location.href = intentUrl;
    setTimeout(() => {
      window.location.href = `vlc://${streamUrl}`;
    }, 600);
    return true;
  }

  // Desktop (macOS / Windows / Linux)
  window.location.href = `vlc://${streamUrl}`;
  return true;
}

/**
 * Generates and triggers instant download of a lightweight .m3u playlist file.
 * When clicked on Desktop, VLC or the default media player opens and streams immediately.
 * @param {string} streamUrl 
 * @param {string} fileName 
 */
export function downloadM3UPlaylist(streamUrl, fileName = 'stream') {
  if (!streamUrl) return;

  const cleanName = (fileName || 'seedr-stream')
    .replace(/\.[^/.]+$/, '') // remove existing extension
    .replace(/[^a-zA-Z0-9._\- ]/g, '_');

  const m3uContent = `#EXTM3U\n#EXTINF:-1,${cleanName}\n${streamUrl}\n`;
  const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${cleanName}.m3u`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 10000);
}

/**
 * Copies stream URL to clipboard
 * @param {string} streamUrl 
 * @returns {Promise<boolean>}
 */
export async function copyVLCStreamUrl(streamUrl) {
  if (!streamUrl) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(streamUrl);
      return true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = streamUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  } catch (e) {
    console.error('Failed to copy stream url', e);
    return false;
  }
}
