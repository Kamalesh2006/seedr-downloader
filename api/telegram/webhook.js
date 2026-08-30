const telegramBot = require('../../server/src/bot/telegramBot');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await telegramBot.handleWebhookUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in Vercel telegram webhook:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
};
