# Seedr Torrent Downloader

A personal web app to search for torrents, send magnet links to your [Seedr.cc](https://seedr.cc) cloud account, monitor download progress, and download completed files — all from a single UI.

## Features

- 🎬 **Discover Movies & Live Mirrors** — Automated search discovery of frequently changing mirror domains, real-time magnet scraping, and one-click Seedr cloud streaming
- 📡 **Ace Stream Live Player** — Stream live broadcasts, sports & channels directly in-browser or VLC by pasting any 40-character Content ID (e.g. `78aa92a70ef16a0e450d861243cc7a90e23aca42`) or `acestream://` URL
- 🤖 **Telegram Bot Integration** — Search torrents, browse Seedr files, get direct download URLs & send magnets on the go
- 🔍 **Search torrents** across multiple providers (1337x, ThePirateBay, YTS)
- 🧲 **Paste magnet links** directly with real-time **File Name auto-detection**
- 🕒 **Recent magnet history** — stores up to 10 recent links with file names, 1-click re-add, and copy
- ☁️ **Cloud download** via Seedr.cc — no local torrenting needed
- 📊 **Real-time progress** tracking with auto-polling
- 📥 **One-click download** for both root files and nested folder contents
- 🗑️ **Seedr Storage Manager** — view storage quota & delete files/folders with confirmation
- 📱 **Responsive dark UI** — works on desktop and mobile

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Seedr.cc](https://seedr.cc) account (premium recommended for API access)
- *(Optional)* [Docker](https://www.docker.com/) or an Ace Stream Engine daemon for in-browser Ace Stream playback
- *(Optional)* A Telegram Bot Token from [@BotFather](https://t.me/BotFather) for Telegram integration

## Quick Start

### 1. Configure credentials

Edit `server/.env` with your Seedr account credentials and optional configurations:

```env
SEEDR_EMAIL=your_email@example.com
SEEDR_PASSWORD=your_password
MAX_FILE_SIZE_GB=4.5
PORT=3001

# Ace Stream Engine (Optional, default: http://127.0.0.1:6878)
ACESTREAM_ENGINE_URL=http://127.0.0.1:6878

# Telegram Bot Integration (Optional)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_BOT_USERNAME=your_seedr_bot
# Optional: restrict bot access to your Telegram user ID or username
TELEGRAM_ALLOWED_USERS=your_telegram_username
```

### 2. Telegram Bot Commands

When the bot is running, you can interact with it using these commands or the persistent quick keyboard:

| Command | Description |
|---------|-------------|
| `/start` | Launch the bot, display welcome menu and quick action buttons |
| `/search <query>` | Search torrents across enabled providers with 1-click `➕ Add to Seedr` |
| `magnet:?xt=...` | Paste any magnet link directly in chat to automatically add to Seedr |
| `/files` or `/myfiles` | Browse Seedr cloud storage folders, view files & generate direct download URLs |
| `/transfers` | Monitor active downloading torrents and progress |
| `/quota` | Check Seedr storage quota and available space |
| `/help` | Display command guide and pro tips |

### 3. Start the backend

```bash
cd server
npm install
node src/index.js
```

The API server starts on `http://localhost:3001`.

### 4. Start the frontend

```bash
cd client
npm install
npm run dev
```

The UI opens at `http://localhost:5173`.

## Architecture

```
seedr/
├── server/              # Express.js backend
│   ├── src/
│   │   ├── index.js          # Server entry point
│   │   ├── routes/
│   │   │   ├── search.js     # Torrent search endpoints
│   │   │   └── seedr.js      # Seedr API proxy endpoints
│   │   └── services/
│   │       ├── searchService.js   # Torrent search logic
│   │       └── seedrService.js    # Seedr.cc API wrapper
│   ├── config.json       # Search providers & settings
│   ├── .env              # Credentials (gitignored)
│   └── package.json
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/client.js
│   │   ├── hooks/
│   │   │   ├── useSearch.js
│   │   │   └── useSeedr.js
│   │   └── components/
│   │       ├── SearchBar.jsx
│   │       ├── SearchResults.jsx
│   │       ├── ActiveDownloads.jsx
│   │       └── CompletedFiles.jsx
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=<query>` | Search torrents |
| POST | `/api/seedr/add` | Add magnet link to Seedr |
| GET | `/api/seedr/status/:id` | Check transfer progress |
| GET | `/api/seedr/folders` | List Seedr root folder |
| GET | `/api/seedr/folder/:id` | List folder contents |
| GET | `/api/seedr/download/:fileId` | Get download URL |
| DELETE | `/api/seedr/file/:fileId` | Delete file from Seedr |
| DELETE | `/api/seedr/folder/:folderId` | Delete folder from Seedr |

## Configuration

Edit `server/config.json` to customize:

```json
{
  "searchProviders": ["1337x", "ThePirateBay", "Yts"],
  "maxFileSizeGB": 4.5,
  "maxResults": 20,
  "seedrPollIntervalMs": 3000,
  "seedrBaseUrl": "https://www.seedr.cc/rest"
}
```

## License

Personal use only.
