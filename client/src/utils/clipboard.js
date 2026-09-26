/**
 * Universal, cross-platform Clipboard Copy Utility
 * Fully compatible with Android TV (HTTP/LAN insecure origins, TV Bro, Puffin, Silk, JioPages),
 * iOS, Android, and Desktop browsers.
 */

export async function copyToClipboard(text) {
  if (!text || typeof text !== 'string') return false;

  // 1. Try modern Async Clipboard API if in Secure Context (HTTPS or localhost)
  if (typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('Async clipboard API failed, falling back to legacy execCommand:', e);
    }
  }

  // 2. Legacy textarea execCommand fallback (Vital for HTTP on LAN like http://192.168.x.x on Android TV)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // Position off-screen without hiding (Android TV requires focusable element)
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.fontSize = '16px'; // Prevents auto-zoom on mobile/TV
    textarea.setAttribute('readonly', ''); // Prevents virtual keyboard popup on TV
    
    document.body.appendChild(textarea);
    
    // Focus and select the text
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      console.warn('execCommand copy error:', err);
      success = false;
    }

    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }

    if (success) return true;
  } catch (err) {
    console.warn('Textarea clipboard fallback failed:', err);
  }

  // 3. Fallback for locked-down TV browsers: prompt dialog
  try {
    if (typeof window !== 'undefined' && window.prompt) {
      window.prompt('Copy to clipboard (Press Ctrl+C or remote OK):', text);
      return true;
    }
  } catch (_) {}

  return false;
}

export async function copyVLCStreamUrl(streamUrl) {
  return copyToClipboard(streamUrl);
}
