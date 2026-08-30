const magnetStorage = require('../../server/src/services/magnetStorageService');

module.exports = async function handler(req, res) {
  const { method } = req;

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

  try {
    if (method === 'GET') {
      const list = await magnetStorage.getRecentMagnets();
      return res.status(200).json({ magnets: list });
    }

    if (method === 'POST') {
      const { magnet, title, name, id, size, status, progress, files } = req.body || {};
      if (!magnet) {
        return res.status(400).json({ error: 'Magnet is required' });
      }
      const updatedList = await magnetStorage.addRecentMagnet({
        magnet,
        title: title || name,
        name: name || title,
        id,
        size,
        status,
        progress,
        files
      });
      return res.status(200).json({ success: true, magnets: updatedList });
    }

    if (method === 'DELETE') {
      const emptyList = await magnetStorage.clearRecentMagnets();
      return res.status(200).json({ success: true, magnets: emptyList });
    }

    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Error in /api/magnets/recent:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message || error });
  }
};
