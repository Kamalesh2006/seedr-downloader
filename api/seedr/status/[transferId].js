const seedrService = require('../../../server/src/services/seedrService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transferId } = req.query;
    const result = await seedrService.getTransferStatus(transferId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get transfer status', details: error.message || error });
  }
};
