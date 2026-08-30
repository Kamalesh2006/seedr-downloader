const downloadQueue = require('../../server/src/services/downloadQueueService');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, direction } = req.body || {};
    const result = downloadQueue.moveItem(id, direction);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to move queue item', details: error.message || error });
  }
};
