const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { apiLimiter } = require('../server/src/middleware/rateLimiter');
const { errorHandler } = require('../server/src/middleware/errorHandler');

const searchRoutes = require('../server/src/routes/search');
const seedrRoutes = require('../server/src/routes/seedr');
const telegramRoutes = require('../server/src/routes/telegram');
const magnetsRoutes = require('../server/src/routes/magnets');
const queueRoutes = require('../server/src/routes/queue');
const acestreamRoutes = require('../server/src/routes/acestream');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

app.use(express.json({ limit: '50kb' }));

// Ace Stream streaming endpoints
app.use('/api/acestream', acestreamRoutes);

app.use('/api', apiLimiter);

app.use('/api/search', searchRoutes);
app.use('/api/seedr', seedrRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/magnets', magnetsRoutes);
app.use('/api/queue', queueRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use(errorHandler);

module.exports = app;

