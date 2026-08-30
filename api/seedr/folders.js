const seedrService = require('../../server/src/services/seedrService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await seedrService.listFolder();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list root folder', details: error.message || error });
  }
};
