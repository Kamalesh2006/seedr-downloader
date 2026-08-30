const downloadQueue = require('../../server/src/services/downloadQueueService');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = downloadQueue.clearQueue();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear queue', details: error.message || error });
  }
};
