const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

// Set of active Server-Sent Events (SSE) connections for Android TV companion receivers
const tvSubscribers = new Set();

/**
 * Returns primary local IPv4 address of this machine (e.g. 192.168.x.x)
 */
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Ensures that the VLC protocol handler (vlc://) is registered on macOS.
 * This allows browser-based clicks on "vlc://..." to launch VLC directly.
 */
function ensureVlcProtocolHandlerMac() {
  if (process.platform !== 'darwin') return;

  const homeDir = os.homedir();
  const appPath = path.join(homeDir, 'Applications', 'VLCLauncher.app');

  // If already installed and exists, verify or skip
  if (fs.existsSync(appPath)) {
    return;
  }

  try {
    const appsDir = path.join(homeDir, 'Applications');
    if (!fs.existsSync(appsDir)) {
      fs.mkdirSync(appsDir, { recursive: true });
    }

    const scriptPath = path.join(os.tmpdir(), 'vlc_handler_setup.applescript');
    const launchPyPath = path.join(os.tmpdir(), 'launch_vlc.py');

    fs.writeFileSync(launchPyPath, `import urllib.parse
import sys
import subprocess
import os

if len(sys.argv) < 2:
    sys.exit(0)

raw_url = sys.argv[1]

if raw_url.startswith('vlc-x-callback://'):
    parsed = urllib.parse.urlparse(raw_url)
    params = urllib.parse.parse_qs(parsed.query)
    stream_url = params.get('url', [''])[0]
elif raw_url.startswith('vlc://'):
    stream_url = raw_url[6:]
elif raw_url.startswith('vlc:'):
    stream_url = raw_url[4:]
else:
    stream_url = raw_url

stream_url = urllib.parse.unquote(stream_url)

if not any(stream_url.startswith(s) for s in ['http://', 'https://', 'ftp://', 'rtsp://', 'mms://']):
    if stream_url.startswith('//'):
        stream_url = 'https:' + stream_url
    else:
        stream_url = 'https://' + stream_url

vlc_paths = [
    '/Applications/VLC.app',
    os.path.expanduser('~/Applications/VLC.app')
]

vlc_app = None
for p in vlc_paths:
    if os.path.exists(p):
        vlc_app = p
        break

if vlc_app:
    subprocess.run(['open', '-a', vlc_app, stream_url])
else:
    subprocess.run(['open', '-a', 'VLC', stream_url])
`);

    fs.writeFileSync(scriptPath, `on open location this_URL
	try
		set appPath to POSIX path of (path to me)
		set scriptPath to appPath & "Contents/Resources/launch.py"
		do shell script "python3 " & quoted form of scriptPath & " " & quoted form of this_URL
	end try
end open location
`);

    const setupCommand = `
      osacompile -o "${appPath}" "${scriptPath}" &&
      cp "${launchPyPath}" "${appPath}/Contents/Resources/launch.py" &&
      /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string 'org.videolan.vlc-url-handler'" "${appPath}/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier 'org.videolan.vlc-url-handler'" "${appPath}/Contents/Info.plist" &&
      /usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "${appPath}/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :LSUIElement true" "${appPath}/Contents/Info.plist" &&
      /usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "${appPath}/Contents/Info.plist" 2>/dev/null || true &&
      /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "${appPath}/Contents/Info.plist" &&
      /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "${appPath}/Contents/Info.plist" &&
      /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLName string 'VLC Protocol Handler'" "${appPath}/Contents/Info.plist" &&
      /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "${appPath}/Contents/Info.plist" &&
      /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string 'vlc'" "${appPath}/Contents/Info.plist" &&
      /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:1 string 'vlc-x-callback'" "${appPath}/Contents/Info.plist" &&
      codesign --force --deep --sign - "${appPath}" &&
      /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${appPath}"
    `;

    exec(setupCommand, (err) => {
      if (err) {
        console.warn('Could not auto-register VLC protocol handler:', err.message);
      } else {
        console.log('✅ VLC protocol handler (vlc://) registered for macOS');
      }
      try {
        fs.unlinkSync(scriptPath);
        fs.unlinkSync(launchPyPath);
      } catch (_) {}
    });
  } catch (err) {
    console.warn('Error setting up VLC protocol handler:', err.message);
  }
}

/**
 * Tests if a given IP address is reachable on typical Android TV ports
 * (5555: ADB, 8008: Google Cast HTTP, 8009: Cast TLS, 8080: VLC Remote HTTP)
 * @param {string} ip 
 * @param {number} timeoutMs 
 * @returns {Promise<{reachable: boolean, openPort?: number, message: string}>}
 */
function testTvReachable(ip, timeoutMs = 1200) {
  return new Promise((resolve) => {
    if (!ip || typeof ip !== 'string') {
      return resolve({ reachable: false, message: 'Invalid IP address' });
    }

    const cleanIp = ip.trim().replace(/^https?:\/\//, '').split(':')[0];
    const portsToProbe = [5555, 8008, 8009, 8080];
    let resolved = false;
    let completed = 0;

    portsToProbe.forEach((port) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ reachable: true, openPort: port, message: `Device active on port ${port}` });
        }
      });

      const onFail = () => {
        socket.destroy();
        completed++;
        if (!resolved && completed === portsToProbe.length) {
          resolve({ reachable: false, message: 'Device did not respond on common Android TV ports (5555/8008/8009/8080)' });
        }
      };

      socket.on('timeout', onFail);
      socket.on('error', onFail);

      try {
        socket.connect(port, cleanIp);
      } catch (e) {
        onFail();
      }
    });
  });
}

/**
 * Registers an active Server-Sent Events (SSE) connection from an Android TV browser or companion receiver.
 */
function addTvSubscriber(res) {
  tvSubscribers.add(res);
  res.on('close', () => {
    tvSubscribers.delete(res);
  });
}

/**
 * Broadcasts a stream event to all connected Android TV companion browsers
 */
function broadcastToTv(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  let sentCount = 0;
  for (const client of tvSubscribers) {
    try {
      client.write(payload);
      sentCount++;
    } catch (e) {
      tvSubscribers.delete(client);
    }
  }
  return sentCount;
}

/**
 * Returns count of active connected Android TV companion sessions
 */
function getTvSubscribersCount() {
  return tvSubscribers.size;
}

/**
 * Attempts to launch/stream video to an Android TV via ADB or VLC Chromecast Output
 * @param {string} streamUrl 
 * @param {string} tvIp 
 * @returns {Promise<{success: boolean, method: string, message: string}>}
 */
async function sendToAndroidTv(streamUrl, tvIp) {
  if (!tvIp || typeof tvIp !== 'string') {
    throw new Error('Android TV IP address is required for remote playback');
  }

  const cleanIp = tvIp.trim().replace(/^https?:\/\//, '').split(':')[0];
  const cleanUrl = streamUrl.trim();

  // Method 1: Check if ADB is available and can launch VLC intent directly on Android TV
  const tryAdb = () => new Promise((resolve) => {
    exec('which adb', (err, stdout) => {
      if (err || !stdout.trim()) {
        return resolve(null);
      }
      const adbCmd = `adb connect ${cleanIp}:5555 && adb -s ${cleanIp}:5555 shell am start -a android.intent.action.VIEW -d "${cleanUrl.replace(/"/g, '\\"')}" -t "video/*" -p org.videolan.vlc`;
      exec(adbCmd, { timeout: 6000 }, (adbErr, adbOut) => {
        if (!adbErr && (adbOut.includes('Starting') || adbOut.includes('connected'))) {
          resolve({ success: true, method: 'adb', message: `Stream sent to Android TV VLC via ADB (${cleanIp})` });
        } else {
          resolve(null);
        }
      });
    });
  });

  const adbResult = await tryAdb();
  if (adbResult) return adbResult;

  // Method 2: Launch local VLC player with Chromecast / Google Cast Stream Output targeted at TV IP
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let vlcBin = 'vlc';

    if (platform === 'darwin') {
      const macVlc = '/Applications/VLC.app/Contents/MacOS/VLC';
      const userMacVlc = path.join(os.homedir(), 'Applications/VLC.app/Contents/MacOS/VLC');
      if (fs.existsSync(macVlc)) {
        vlcBin = macVlc;
      } else if (fs.existsSync(userMacVlc)) {
        vlcBin = userMacVlc;
      }
    } else if (platform === 'win32') {
      const winPaths = [
        'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
        'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
      ];
      for (const p of winPaths) {
        if (fs.existsSync(p)) {
          vlcBin = p;
          break;
        }
      }
    }

    // VLC command with chromecast stream output targeting TV IP
    const command = `"${vlcBin}" "${cleanUrl.replace(/"/g, '\\"')}" --sout-chromecast-ip=${cleanIp} --demux-filter=demux_chromecast`;

    exec(command + ' &', { timeout: 4000 }, (err) => {
      if (err && err.code !== 0 && !err.killed) {
        console.warn('VLC Chromecast launch note:', err.message);
      }
      resolve({
        success: true,
        method: 'vlc-chromecast',
        message: `VLC launched casting stream to Android TV at ${cleanIp}`
      });
    });
  });
}

/**
 * Directly launches VLC media player with a given stream URL
 * Supports:
 * - Local desktop playback (macOS, Windows, Linux)
 * - Remote Android TV playback (via ADB / Chromecast)
 * - Broadcasting to connected Android TV companion browser clients
 * 
 * @param {string} streamUrl 
 * @param {Object} options { target: 'device' | 'android-tv' | 'both', tvIp?: string, fileName?: string }
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function launchVlcApp(streamUrl, options = {}) {
  if (!streamUrl || typeof streamUrl !== 'string') {
    throw new Error('Invalid stream URL');
  }

  const { target = 'device', tvIp = process.env.ANDROID_TV_IP, fileName = 'Media' } = options;
  const cleanUrl = streamUrl.trim();
  const platform = process.platform;
  const results = [];

  // 1. Broadcast to any connected Android TV companion sessions (SSE)
  const companionCount = broadcastToTv({
    type: 'launch-vlc',
    url: cleanUrl,
    fileName,
    timestamp: Date.now()
  });
  if (companionCount > 0) {
    results.push(`Pushed to ${companionCount} connected Android TV companion screen(s)`);
  }

  // 2. If Android TV target requested or tvIp provided:
  if (target === 'android-tv' || target === 'both' || (tvIp && target !== 'device')) {
    if (tvIp) {
      try {
        const tvResult = await sendToAndroidTv(cleanUrl, tvIp);
        results.push(tvResult.message);
      } catch (err) {
        console.warn('Android TV remote launch warning:', err.message);
        results.push(`Note: Android TV IP ${tvIp} was targeted`);
      }
    }
  }

  // 3. If target is 'device' or 'both', launch locally on desktop
  if (target === 'device' || target === 'both') {
    await new Promise((resolve, reject) => {
      if (platform === 'darwin') {
        const vlcExists = fs.existsSync('/Applications/VLC.app') || fs.existsSync(path.join(os.homedir(), 'Applications', 'VLC.app'));
        const appName = vlcExists ? 'VLC' : 'VLC';

        exec(`open -a "${appName}" "${cleanUrl.replace(/"/g, '\\"')}"`, (err) => {
          if (err) return reject(err);
          results.push('Local VLC launched on macOS');
          resolve(true);
        });
      } else if (platform === 'win32') {
        exec(`start "" vlc "${cleanUrl.replace(/"/g, '\\"')}"`, (err) => {
          if (err) return reject(err);
          results.push('Local VLC launched on Windows');
          resolve(true);
        });
      } else if (platform === 'linux') {
        exec(`vlc "${cleanUrl.replace(/"/g, '\\"')}" &`, (err) => {
          if (err) return reject(err);
          results.push('Local VLC launched on Linux');
          resolve(true);
        });
      } else {
        // Unknown platform, but still resolved if remote playback was done
        resolve(true);
      }
    });
  }

  return {
    success: true,
    message: results.join(' • ') || 'VLC launch command processed'
  };
}

module.exports = {
  ensureVlcProtocolHandlerMac,
  launchVlcApp,
  sendToAndroidTv,
  testTvReachable,
  addTvSubscriber,
  broadcastToTv,
  getTvSubscribersCount,
  getLocalIp
};
