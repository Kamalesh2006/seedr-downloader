const downloadQueue = require('../../server/src/services/downloadQueueService');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { enabled } = req.body || {};
    const result = downloadQueue.toggleAutoProcessor(enabled);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle queue auto processor', details: error.message || error });
  }
};
