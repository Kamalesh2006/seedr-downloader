const downloadQueue = require('../../server/src/services/downloadQueueService');

function parseName(magnet, providedName) {
  if (providedName && providedName.trim()) return providedName.trim();
  try {
    const dnMatch = magnet.match(/[?&]dn=([^&]+)/i);
    if (dnMatch && dnMatch[1]) {
      return decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')).trim();
    }
  } catch (e) {}
  return 'Scheduled Torrent';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { magnet, name, size } = req.body || {};
    if (!magnet) {
      return res.status(400).json({ error: 'Magnet link is required' });
    }

    const finalName = parseName(magnet, name);
    const item = downloadQueue.addToQueue({ magnet, name: finalName, size });
    res.json({ success: true, item, queue: downloadQueue.queue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add item to queue', details: error.message || error });
  }
};
