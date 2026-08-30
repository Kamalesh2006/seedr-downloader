const express = require('express');
const cors = require('cors');

const searchRoutes = require('../server/src/routes/search');
const seedrRoutes = require('../server/src/routes/seedr');
const telegramRoutes = require('../server/src/routes/telegram');
const magnetsRoutes = require('../server/src/routes/magnets');
const queueRoutes = require('../server/src/routes/queue');

const app = express();

app.use(cors());
app.use(express.json());

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

module.exports = app;
