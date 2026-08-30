const seedrService = require('../../../server/src/services/seedrService');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const result = await seedrService.deleteTask(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task', details: error.message || error });
  }
};
