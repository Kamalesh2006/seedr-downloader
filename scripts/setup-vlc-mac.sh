#!/usr/bin/env bash
# Setup VLC URL Scheme Handler for macOS
# Registers vlc:// so that links clicked in web browsers open the VLC desktop app directly.

set -e

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "This script is only needed for macOS."
  exit 0
fi

echo "🎬 Setting up VLC URL scheme handler for macOS..."

APP_DIR="$HOME/Applications/VLCLauncher.app"
TMP_DIR=$(mktemp -d)

mkdir -p "$HOME/Applications"

cat << 'EOF' > "$TMP_DIR/launch.py"
import urllib.parse
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
EOF

cat << 'EOF' > "$TMP_DIR/handler.applescript"
on open location this_URL
	try
		set appPath to POSIX path of (path to me)
		set scriptPath to appPath & "Contents/Resources/launch.py"
		do shell script "python3 " & quoted form of scriptPath & " " & quoted form of this_URL
	end try
end open location
EOF

rm -rf "$APP_DIR"
osacompile -o "$APP_DIR" "$TMP_DIR/handler.applescript"
cp "$TMP_DIR/launch.py" "$APP_DIR/Contents/Resources/launch.py"

PLIST="$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string 'org.videolan.vlc-url-handler'" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier 'org.videolan.vlc-url-handler'" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :LSUIElement true" "$PLIST"
/usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLName string 'VLC Protocol Handler'" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string 'vlc'" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:1 string 'vlc-x-callback'" "$PLIST"

codesign --force --deep --sign - "$APP_DIR"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_DIR"

rm -rf "$TMP_DIR"
echo "✅ VLC URL handler successfully installed and registered to $APP_DIR"
echo "Now web browsers can open VLC via vlc:// stream links directly!"
