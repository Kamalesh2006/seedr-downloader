const torrentWatchdog = require('../../server/src/services/torrentWatchdogService');

module.exports = async function handler(req, res) {
  try {
    const status = torrentWatchdog.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get watchdog status', details: error.message || error });
  }
};
