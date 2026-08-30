const telegramBot = require('../../server/src/bot/telegramBot');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  let botInfo = null;

  if (isConfigured && telegramBot.bot) {
    try {
      botInfo = await telegramBot.bot.getMe();
    } catch (e) {}
  }

  res.json({
    enabled: isConfigured,
    botUsername: botInfo?.username || process.env.TELEGRAM_BOT_USERNAME || null,
    botName: botInfo?.first_name || 'Seedr Downloader Bot'
  });
};
