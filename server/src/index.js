require('dotenv').config();
const express = require('express');
const cors = require('cors');

const searchRoutes = require('./routes/search');
const seedrRoutes = require('./routes/seedr');
const telegramRoutes = require('./routes/telegram');
const magnetsRoutes = require('./routes/magnets');
const telegramBot = require('./bot/telegramBot');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/search', searchRoutes);
app.use('/api/seedr', seedrRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/magnets', magnetsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`- Search API: http://localhost:${PORT}/api/search`);
  console.log(`- Seedr API: http://localhost:${PORT}/api/seedr`);
  console.log(`- Telegram API: http://localhost:${PORT}/api/telegram`);

  // Initialize Telegram Bot in polling mode if token exists
  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot.init(true);
  } else {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN is not set in .env. To enable the Telegram Bot, set TELEGRAM_BOT_TOKEN.');
  }
});
