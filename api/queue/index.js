const downloadQueue = require('../../server/src/services/downloadQueueService');

module.exports = async function handler(req, res) {
  try {
    const status = downloadQueue.getQueueStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get queue status', details: error.message || error });
  }
};
