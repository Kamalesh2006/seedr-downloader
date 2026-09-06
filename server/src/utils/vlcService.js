const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
 * Directly launches VLC media player with a given stream URL
 * @param {string} streamUrl 
 * @returns {Promise<boolean>}
 */
function launchVlcApp(streamUrl) {
  return new Promise((resolve, reject) => {
    if (!streamUrl || typeof streamUrl !== 'string') {
      return reject(new Error('Invalid stream URL'));
    }

    const platform = process.platform;
    const cleanUrl = streamUrl.trim();

    if (platform === 'darwin') {
      // Check if VLC is installed
      const vlcExists = fs.existsSync('/Applications/VLC.app') || fs.existsSync(path.join(os.homedir(), 'Applications', 'VLC.app'));
      const appName = vlcExists ? 'VLC' : 'VLC';

      exec(`open -a "${appName}" "${cleanUrl.replace(/"/g, '\\"')}"`, (err) => {
        if (err) {
          return reject(err);
        }
        resolve(true);
      });
    } else if (platform === 'win32') {
      exec(`start "" vlc "${cleanUrl.replace(/"/g, '\\"')}"`, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    } else if (platform === 'linux') {
      exec(`vlc "${cleanUrl.replace(/"/g, '\\"')}" &`, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    } else {
      reject(new Error(`Unsupported OS: ${platform}`));
    }
  });
}

module.exports = {
  ensureVlcProtocolHandlerMac,
  launchVlcApp
};
