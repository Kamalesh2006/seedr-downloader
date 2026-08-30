require('dotenv').config();
const express = require('express');
const cors = require('cors');

const searchRoutes = require('./routes/search');
const seedrRoutes = require('./routes/seedr');
const telegramRoutes = require('./routes/telegram');
const magnetsRoutes = require('./routes/magnets');
const queueRoutes = require('./routes/queue');
const telegramBot = require('./bot/telegramBot');
const torrentWatchdog = require('./services/torrentWatchdogService');
const downloadQueue = require('./services/downloadQueueService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/search', searchRoutes);
app.use('/api/seedr', seedrRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/magnets', magnetsRoutes);
app.use('/api/queue', queueRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`- Search API: http://localhost:${PORT}/api/search`);
  console.log(`- Seedr API: http://localhost:${PORT}/api/seedr`);
  console.log(`- Queue API: http://localhost:${PORT}/api/queue`);
  console.log(`- Telegram API: http://localhost:${PORT}/api/telegram`);

  // Start background auto-cleanup watchdog for stalled (2m) and long-running (1h) torrents
  torrentWatchdog.start();

  // Start download queue scheduler for automated order-wise processing
  downloadQueue.start();

  // Initialize Telegram Bot in polling mode if token exists
  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot.init(true);
  } else {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN is not set in .env. To enable the Telegram Bot, set TELEGRAM_BOT_TOKEN.');
  }
});
