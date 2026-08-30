const seedrService = require('../../../server/src/services/seedrService');

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const result = await seedrService.listFolder(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list folder', details: error.message || error });
    }
  } else if (req.method === 'DELETE') {
    try {
      const result = await seedrService.deleteFolder(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete folder', details: error.message || error });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
