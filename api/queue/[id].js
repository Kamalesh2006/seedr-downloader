const downloadQueue = require('../../server/src/services/downloadQueueService');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const result = downloadQueue.removeFromQueue(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove queue item', details: error.message || error });
  }
};
