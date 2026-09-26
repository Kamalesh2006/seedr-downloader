const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const config = require('../../config.json');

function getProxyAgent() {
  // Only use explicitly configured torrent proxy (do not inherit corporate proxies like 127.0.0.1:3128)
  const proxyUrl = process.env.PROXY_URL || config.proxyUrl || config.proxy;
  if (!proxyUrl || typeof proxyUrl !== 'string' || !proxyUrl.trim()) return null;
  const clean = proxyUrl.trim();
  if (clean.includes('127.0.0.1:3128')) return null;

  try {
    if (clean.startsWith('socks')) {
      return new SocksProxyAgent(clean);
    }
    return new HttpsProxyAgent(clean);
  } catch (err) {
    console.warn('[NetworkHelper] Invalid proxy configuration:', clean, err.message);
    return null;
  }
}

function getAxiosNetworkConfig() {
  const agent = getProxyAgent();
  if (agent) {
    return {
      httpsAgent: agent,
      httpAgent: agent,
      proxy: false
    };
  }
  // Explicitly disable proxy inheritance to bypass local corporate proxy for torrent traffic
  return { proxy: false };
}

module.exports = {
  getProxyAgent,
  getAxiosNetworkConfig
};
