const express = require('express');
const router = express.Router();
const telegramBot = require('../bot/telegramBot');

// Check Telegram bot status
router.get('/status', async (req, res) => {
  const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  let botInfo = null;

  if (isConfigured && telegramBot.bot) {
    try {
      botInfo = await telegramBot.bot.getMe();
    } catch (e) {
      // Bot might be starting up or network issue
    }
  }

  res.json({
    enabled: isConfigured,
    botUsername: botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || null,
    botName: botInfo?.first_name || 'Seedr Downloader Bot'
  });
});

// Webhook endpoint (if using Telegram webhooks)
router.post('/webhook', async (req, res) => {
  try {
    await telegramBot.handleWebhookUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling webhook update:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
});

module.exports = router;
