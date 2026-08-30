const magnetStorage = require('../../../server/src/services/magnetStorageService');

module.exports = async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!id) {
    return res.status(400).json({ error: 'ID parameter is required' });
  }

  try {
    if (method === 'PUT' || method === 'PATCH') {
      const updates = req.body || {};
      const updatedList = await magnetStorage.updateRecentMagnet(id, updates);
      return res.status(200).json({ success: true, magnets: updatedList });
    }

    if (method === 'DELETE') {
      const updatedList = await magnetStorage.removeRecentMagnet(id);
      return res.status(200).json({ success: true, magnets: updatedList });
    }

    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error(`Error in /api/magnets/recent/${id}:`, error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message || error });
  }
};
