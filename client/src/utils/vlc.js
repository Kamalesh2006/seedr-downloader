/**
 * VLC Media Player Integration Utilities
 * Supports launching VLC on Android TV, Android, iOS, macOS, Windows, and Linux,
 * as well as remote network streaming to Android TV (via ADB / Chromecast / TV Companion),
 * generating M3U stream playlists, and clipboard copy helpers.
 */

/**
 * Returns comprehensive device information including Android TV detection
 */
export function getDeviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isAndroidTV = /Android.*TV|AndroidTV|GoogleTV|SmartTV|BRAVIA|AFTT|AFTM|AFTB|AFT|MiBOX|Shield|Nexus Player|CrKey/i.test(ua) || (isAndroid && !/Mobi/i.test(ua));
  const isMobile = isIOS || (isAndroid && !isAndroidTV) || /Mobi|Tablet/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  const isWindows = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  return {
    isIOS,
    isAndroid,
    isAndroidTV,
    isMobile,
    isMac,
    isWindows,
    isLinux,
    osName: isAndroidTV ? 'Android TV' : isIOS ? 'iOS' : isAndroid ? 'Android' : isMac ? 'macOS' : isWindows ? 'Windows' : isLinux ? 'Linux' : 'Device'
  };
}

/**
 * Helper to dispatch synthetic click on an anchor element.
 * Needed for Android TV and mobile browsers where window.location.href to custom schemes is blocked.
 */
function triggerExternalUrl(url) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_self';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1200);
    return true;
  } catch (e) {
    window.location.href = url;
    return true;
  }
}

/**
 * Launches VLC app on Android or Android TV using a robust intent & protocol chain
 * Targets explicit VideoPlayerActivity, standard ACTION_VIEW intent, and vlc:// schemes.
 */
export function launchAndroidVlcIntent(streamUrl) {
  if (!streamUrl) return false;

  const scheme = streamUrl.startsWith('https') ? 'https' : 'http';
  const noScheme = streamUrl.replace(/^https?:\/\//, '');

  // 1. Android TV explicit VideoPlayerActivity intent
  const explicitIntent = `intent://${noScheme}#Intent;scheme=${scheme};type=video/*;package=org.videolan.vlc;component=org.videolan.vlc/.gui.video.VideoPlayerActivity;action=android.intent.action.VIEW;end`;
  
  // 2. Standard VLC Android intent
  const standardIntent = `intent://${noScheme}#Intent;scheme=${scheme};type=video/*;package=org.videolan.vlc;action=android.intent.action.VIEW;end`;

  // 3. Custom vlc:// scheme
  const vlcScheme = `vlc://${streamUrl}`;

  // 4. x-callback scheme
  const xCallback = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`;

  triggerExternalUrl(explicitIntent);

  setTimeout(() => {
    triggerExternalUrl(standardIntent);
  }, 450);

  setTimeout(() => {
    triggerExternalUrl(vlcScheme);
  }, 900);

  setTimeout(() => {
    triggerExternalUrl(xCallback);
  }, 1400);

  return true;
}

/**
 * Persisted settings helpers for Android TV
 */
export function getSavedAndroidTvIp() {
  try {
    return localStorage.getItem('seedr_android_tv_ip') || '';
  } catch (e) {
    return '';
  }
}

export function setSavedAndroidTvIp(ip) {
  try {
    localStorage.setItem('seedr_android_tv_ip', (ip || '').trim());
  } catch (e) {}
}

export function getSavedVlcTarget() {
  try {
    return localStorage.getItem('seedr_vlc_target') || 'device';
  } catch (e) {
    return 'device';
  }
}

export function setSavedVlcTarget(target) {
  try {
    localStorage.setItem('seedr_vlc_target', target || 'device');
  } catch (e) {}
}

/**
 * Tests if an Android TV IP is reachable via the backend
 */
export async function testAndroidTvConnection(tvIp) {
  if (!tvIp) return { success: false, message: 'Please provide an Android TV IP' };
  try {
    const res = await fetch('/api/seedr/test-tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tvIp })
    });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, message: 'Server error testing TV' };
  } catch (e) {
    return { success: false, message: e.message || 'Network error' };
  }
}

/**
 * Sends a video stream specifically to Android TV over the network (via local server bridge)
 */
export async function streamToAndroidTv(streamUrl, tvIp, fileName = 'video') {
  if (!streamUrl) return { success: false, message: 'Invalid stream URL' };
  const targetIp = tvIp || getSavedAndroidTvIp();

  try {
    const res = await fetch('/api/seedr/open-vlc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: streamUrl,
        fileName,
        target: 'android-tv',
        tvIp: targetIp
      })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Stream sent to Android TV' };
    }
    const err = await res.json();
    return { success: false, message: err.error || 'Failed to stream to Android TV' };
  } catch (e) {
    return { success: false, message: e.message || 'Network error reaching backend' };
  }
}

/**
 * Main function: Attempts to launch VLC media player with the direct video/media stream URL.
 * Automatically checks whether the current device is Android TV, or if the user has configured
 * Android TV streaming or requested target: 'android-tv' / 'both'.
 * 
 * @param {string} streamUrl Direct HTTP/HTTPS stream URL
 * @param {string} fileName Optional filename
 * @param {Object} options Optional config: { target: 'device' | 'android-tv' | 'both', tvIp?: string }
 */
export async function openInVLC(streamUrl, fileName = 'video', options = {}) {
  if (!streamUrl) return false;

  const device = getDeviceInfo();
  const defaultTarget = getSavedVlcTarget();
  const target = options.target || defaultTarget || 'device';
  const tvIp = options.tvIp || getSavedAndroidTvIp();

  // If user is directly on an Android TV device or Android mobile
  if (device.isAndroidTV || (device.isAndroid && target !== 'android-tv')) {
    launchAndroidVlcIntent(streamUrl);
    return true;
  }

  // If target includes Android TV and we are running from PC/Mac/mobile:
  if (target === 'android-tv' || target === 'both') {
    try {
      await fetch('/api/seedr/open-vlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: streamUrl,
          fileName,
          target,
          tvIp
        })
      });
    } catch (e) {
      console.warn('Backend Android TV launch note:', e);
    }

    if (target === 'android-tv') {
      return true;
    }
  }

  // iOS VLC custom x-callback scheme or direct vlc:// scheme
  if (device.isIOS) {
    const encoded = encodeURIComponent(streamUrl);
    const vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encoded}`;
    triggerExternalUrl(vlcUrl);
    setTimeout(() => {
      triggerExternalUrl(`vlc://${streamUrl}`);
    }, 600);
    return true;
  }

  // Desktop (macOS / Windows / Linux) - Local launch via local backend API bridge
  try {
    const res = await fetch('/api/seedr/open-vlc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: streamUrl,
        fileName,
        target: 'device',
        tvIp
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return true;
      }
    }
  } catch (e) {
    // Backend API not reachable or remote server, continue to scheme handler
  }

  // Custom vlc:// protocol handler fallback for desktop
  const cleanUrl = streamUrl.replace(/^vlc:\/\//, '');
  triggerExternalUrl(`vlc://${cleanUrl}`);
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

import { copyToClipboard } from './clipboard';

/**
 * Copies stream URL to clipboard (universal cross-platform, works on Android TV)
 * @param {string} streamUrl 
 * @returns {Promise<boolean>}
 */
export async function copyVLCStreamUrl(streamUrl) {
  return copyToClipboard(streamUrl);
}

export { copyToClipboard };

