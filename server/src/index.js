require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

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

// Trust proxy for rate limiter when running behind Vercel / Nginx reverse proxies
app.set('trust proxy', 1);

// 1. HTTP Security Headers (prevents sniffing, clickjacking, strips X-Powered-By)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));

// 2. Strict CORS & Payload Limits
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50kb' }));

// 3. Global API Rate Limiter
app.use('/api', apiLimiter);

// 4. API Routes
app.use('/api/search', searchRoutes);
app.use('/api/seedr', seedrRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/magnets', magnetsRoutes);
app.use('/api/queue', queueRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 5. Global Error Handler (Sanitizes all errors, prevents credential leaks)
app.use(errorHandler);

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

