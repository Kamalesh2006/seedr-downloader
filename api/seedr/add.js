const seedrService = require('../../server/src/services/seedrService');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { magnet } = req.body;
    if (!magnet) {
      return res.status(400).json({ error: 'Magnet link is required' });
    }
    const result = await seedrService.addMagnet(magnet);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add magnet', details: error.message || error });
  }
};
