const TelegramBot = require('node-telegram-bot-api');
const searchService = require('../services/searchService');
const seedrService = require('../services/seedrService');
const config = require('../../config.json');

// In-memory cache for action data (to circumvent Telegram's 64-byte callback_data limit)
const actionCache = new Map();

function storeActionData(data) {
  const id = Math.random().toString(36).substring(2, 10);
  actionCache.set(id, { ...data, createdAt: Date.now() });

  // Clean old entries (> 2 hours) if cache grows large
  if (actionCache.size > 1000) {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [key, value] of actionCache.entries()) {
      if (value.createdAt < cutoff) {
        actionCache.delete(key);
      }
    }
  }
  return id;
}

function getActionData(id) {
  return actionCache.get(id);
}

// Format bytes to human readable string
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Generate visual text progress bar
function renderProgressBar(percentage, length = 10) {
  const safePercent = Math.max(0, Math.min(100, percentage || 0));
  const filledCount = Math.round((safePercent / 100) * length);
  const emptyCount = length - filledCount;
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${safePercent.toFixed(1)}%`;
}

// Escape HTML special characters for safe Telegram HTML formatting
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Extract display name from magnet link
function extractMagnetName(magnet) {
  try {
    const match = magnet.match(/dn=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
  } catch (e) {}
  return 'Torrent Magnet';
}

class SeedrTelegramBot {
  constructor() {
    this.bot = null;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.allowedUsers = process.env.TELEGRAM_ALLOWED_USERS
      ? process.env.TELEGRAM_ALLOWED_USERS.split(',').map(u => u.trim().toLowerCase())
      : null;
    
    // User conversation states (e.g. waiting for search input)
    this.userStates = new Map();
  }

  // Check if user is authorized
  isUserAllowed(msg) {
    if (!this.allowedUsers || this.allowedUsers.length === 0) {
      return true; // No restriction
    }
    const fromId = msg.from?.id ? String(msg.from.id) : '';
    const username = msg.from?.username ? msg.from.username.toLowerCase() : '';
    return this.allowedUsers.includes(fromId) || (username && this.allowedUsers.includes(username));
  }

  // Initialize bot (long polling mode for server/local)
  init(polling = true) {
    if (!this.token) {
      console.log('ℹ️  TELEGRAM_BOT_TOKEN not configured in .env. Telegram Bot is disabled.');
      return null;
    }

    try {
      this.bot = new TelegramBot(this.token, { polling });
      this.registerHandlers();
      
      this.bot.on('polling_error', (error) => {
        console.error('Telegram Bot Polling Error:', error.message || error);
      });

      console.log('🤖 Telegram Bot initialized successfully.');
      return this.bot;
    } catch (error) {
      console.error('Failed to initialize Telegram Bot:', error.message || error);
      return null;
    }
  }

  // Process webhook updates (for serverless/Vercel)
  async handleWebhookUpdate(update) {
    if (!this.bot) {
      if (!this.token) return { error: 'No bot token' };
      this.bot = new TelegramBot(this.token, { polling: false });
      this.registerHandlers();
    }
    return this.bot.processUpdate(update);
  }

  // Register command and callback handlers
  registerHandlers() {
    if (!this.bot) return;

    // Main persistent keyboard markup
    const mainKeyboard = {
      reply_markup: {
        keyboard: [
          [{ text: '🔍 Search Torrents' }, { text: '📁 Seedr Files' }],
          [{ text: '⚡ Active Transfers' }, { text: '💾 Storage Quota' }],
          [{ text: '❓ Help' }]
        ],
        resize_keyboard: true,
        persistent: true
      }
    };

    // Helper to send unauthorized warning
    const sendUnauthorized = (chatId, from) => {
      const id = from?.id || 'Unknown';
      const user = from?.username ? `@${from.username}` : 'N/A';
      return this.bot.sendMessage(
        chatId,
        `⛔ <b>Access Restricted</b>\n\nYour account (ID: <code>${id}</code>, User: ${user}) is not in the authorized list for this Seedr Bot.\nTo grant access, add your ID to <code>TELEGRAM_ALLOWED_USERS</code> in <code>server/.env</code>.`,
        { parse_mode: 'HTML' }
      );
    };

    // /start command
    this.bot.onText(/^\/start/, async (msg) => {
      if (!this.isUserAllowed(msg)) return sendUnauthorized(msg.chat.id, msg.from);
      this.userStates.delete(msg.chat.id);

      const welcomeText = 
        `👋 <b>Welcome to Seedr Torrent Bot!</b>\n\n` +
        `Search torrents, send magnet links to your Seedr cloud, browse files, and download completed media directly from Telegram.\n\n` +
        `⚡ <b>Quick Actions:</b>\n` +
        `• 🔍 <b>Search:</b> Type <code>/search &lt;query&gt;</code> or click below\n` +
        `• 🧲 <b>Magnet:</b> Paste any <code>magnet:?xt=...</code> link directly\n` +
        `• 📁 <b>Files:</b> Use <code>/files</code> to view Seedr cloud storage\n` +
        `• ⚡ <b>Transfers:</b> Use <code>/transfers</code> for active downloads\n` +
        `• 💾 <b>Storage:</b> Use <code>/quota</code> to check remaining space\n\n` +
        `<i>Choose an option below to get started:</i>`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '🔍 Search Torrents', callback_data: 'cmd_search_prompt' },
            { text: '📁 My Seedr Files', callback_data: 'nav_folder:root' }
          ],
          [
            { text: '⚡ Active Transfers', callback_data: 'cmd_transfers' },
            { text: '💾 Storage Quota', callback_data: 'cmd_quota' }
          ]
        ]
      };

      await this.bot.sendMessage(msg.chat.id, welcomeText, {
        parse_mode: 'HTML',
        ...mainKeyboard
      });

      await this.bot.sendMessage(msg.chat.id, '👇 Quick Access Menu:', {
        reply_markup: inlineKeyboard
      });
    });

    // /help command
    this.bot.onText(/^\/help/, async (msg) => {
      if (!this.isUserAllowed(msg)) return sendUnauthorized(msg.chat.id, msg.from);
      
      const helpText = 
        `📖 <b>Seedr Bot Command Guide:</b>\n\n` +
        `• <code>/search &lt;query&gt;</code> - Search across 1337x, ThePirateBay, YTS\n` +
        `• <code>/files</code> or <code>/myfiles</code> - Browse cloud files & generate download links\n` +
        `• <code>/transfers</code> - Monitor currently downloading torrents\n` +
        `• <code>/quota</code> - Check Seedr account storage usage\n` +
        `• <code>/help</code> - Show this command reference\n\n` +
        `💡 <b>Pro Tip:</b> You can paste any <b>magnet link</b> right into the chat to immediately add it to your Seedr cloud!`;

      await this.bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'HTML', ...mainKeyboard });
    });

    // /search <query> command
    this.bot.onText(/^\/search(?:\s+(.+))?/, async (msg, match) => {
      if (!this.isUserAllowed(msg)) return sendUnauthorized(msg.chat.id, msg.from);

      const query = match[1]?.trim();
      if (!query) {
        this.userStates.set(msg.chat.id, 'waiting_for_search');
        return this.bot.sendMessage(msg.chat.id, '🔍 Please send the search query for the torrent you want to find:');
      }

      await this.executeTorrentSearch(msg.chat.id, query);
    });

    // /files or /myfiles or /storage command
    this.bot.onText(/^\/(?:files|myfiles|storage)/, async (msg) => {
      if (!this.isUserAllowed(msg)) return sendUnauthorized(msg.chat.id, msg.from);
      await this.displayFolder(msg.chat.id, 'root');
    });

    // /transfers or /active command
    this.bot.onText(/^\/(?:transfers|active)/, async (msg) => {
      if (!this.isUserAllowed(msg)) return sendUnauthorized(msg.chat.id, msg.from);
      await this.displayActiveTransfers(msg.chat.id);
    });

    // /quota command
    this.bot.onText(/^\/quota/, async (msg) => {
      if (!this.isUserAllowed(msg)) return sendUnauthorized(msg.chat.id, msg.from);
      await this.displayStorageQuota(msg.chat.id);
    });

    // Handle generic text messages (keyboard buttons, search input, magnet links)
    this.bot.on('message', async (msg) => {
      // Ignore non-text messages or command messages already handled
      if (!msg.text || msg.text.startsWith('/')) return;
      if (!this.isUserAllowed(msg)) return sendUnauthorized(msg.chat.id, msg.from);

      const text = msg.text.trim();

      // Handle main reply keyboard buttons
      if (text === '🔍 Search Torrents') {
        this.userStates.set(msg.chat.id, 'waiting_for_search');
        return this.bot.sendMessage(msg.chat.id, '🔍 Send the movie, show, or file name you want to search:');
      }
      if (text === '📁 Seedr Files') {
        return this.displayFolder(msg.chat.id, 'root');
      }
      if (text === '⚡ Active Transfers') {
        return this.displayActiveTransfers(msg.chat.id);
      }
      if (text === '💾 Storage Quota') {
        return this.displayStorageQuota(msg.chat.id);
      }
      if (text === '❓ Help') {
        return this.bot.sendMessage(msg.chat.id, 'Type <code>/help</code> or paste a magnet link!', { parse_mode: 'HTML' });
      }

      // Check if text is a magnet link
      if (text.startsWith('magnet:?xt=')) {
        this.userStates.delete(msg.chat.id);
        return this.handleDirectMagnet(msg.chat.id, text);
      }

      // Check if user was waiting for search input
      if (this.userStates.get(msg.chat.id) === 'waiting_for_search') {
        this.userStates.delete(msg.chat.id);
        return this.executeTorrentSearch(msg.chat.id, text);
      }

      // Default fallback: if user just types a query, perform search
      return this.executeTorrentSearch(msg.chat.id, text);
    });

    // Handle Inline Keyboard Callback Queries
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat?.id;
      const messageId = query.message?.message_id;
      const data = query.data;

      if (!chatId || !data) return;
      if (!this.isUserAllowed(query)) {
        await this.bot.answerCallbackQuery(query.id, { text: '⛔ Unauthorized', show_alert: true });
        return;
      }

      try {
        // Navigation: Prompt search
        if (data === 'cmd_search_prompt') {
          this.userStates.set(chatId, 'waiting_for_search');
          await this.bot.answerCallbackQuery(query.id);
          return this.bot.sendMessage(chatId, '🔍 Send the torrent title you want to search:');
        }

        // Navigation: Active transfers
        if (data === 'cmd_transfers') {
          await this.bot.answerCallbackQuery(query.id);
          return this.displayActiveTransfers(chatId, messageId);
        }

        // Navigation: Quota
        if (data === 'cmd_quota') {
          await this.bot.answerCallbackQuery(query.id);
          return this.displayStorageQuota(chatId, messageId);
        }

        // Add to Seedr action from search results: add_res:<cacheId>
        if (data.startsWith('add_res:')) {
          const cacheId = data.replace('add_res:', '');
          const cached = getActionData(cacheId);

          if (!cached || !cached.magnet) {
            return this.bot.answerCallbackQuery(query.id, {
              text: '⚠️ Search result expired. Please search again.',
              show_alert: true
            });
          }

          await this.bot.answerCallbackQuery(query.id, { text: 'Adding to Seedr...' });
          return this.handleAddTorrent(chatId, cached.magnet, cached.title);
        }

        // Browse folder: nav_folder:<folderId>
        if (data.startsWith('nav_folder:')) {
          const folderId = data.replace('nav_folder:', '');
          await this.bot.answerCallbackQuery(query.id);
          return this.displayFolder(chatId, folderId, messageId);
        }

        // View file details: view_file:<fileId>:<folderId>
        if (data.startsWith('view_file:')) {
          const parts = data.split(':');
          const fileId = parts[1];
          const parentFolderId = parts[2] || 'root';
          await this.bot.answerCallbackQuery(query.id);
          return this.displayFileDetails(chatId, fileId, parentFolderId, messageId);
        }

        // Get download link: get_dl:<fileId>:<folderId>
        if (data.startsWith('get_dl:')) {
          const parts = data.split(':');
          const fileId = parts[1];
          const parentFolderId = parts[2] || 'root';
          await this.bot.answerCallbackQuery(query.id, { text: 'Generating download link...' });
          return this.generateFileDownloadLink(chatId, fileId, parentFolderId, messageId);
        }

        // Delete prompt for file: del_prompt:file:<fileId>:<folderId>
        if (data.startsWith('del_prompt:file:')) {
          const parts = data.split(':');
          const fileId = parts[2];
          const parentFolderId = parts[3] || 'root';
          await this.bot.answerCallbackQuery(query.id);
          return this.displayDeleteConfirmation(chatId, 'file', fileId, parentFolderId, messageId);
        }

        // Delete prompt for folder: del_prompt:folder:<folderId>
        if (data.startsWith('del_prompt:folder:')) {
          const folderId = data.replace('del_prompt:folder:', '');
          await this.bot.answerCallbackQuery(query.id);
          return this.displayDeleteConfirmation(chatId, 'folder', folderId, 'root', messageId);
        }

        // Delete confirmation: del_confirm:file:<fileId>:<folderId>
        if (data.startsWith('del_confirm:file:')) {
          const parts = data.split(':');
          const fileId = parts[2];
          const parentFolderId = parts[3] || 'root';
          await this.bot.answerCallbackQuery(query.id, { text: 'Deleting file...' });
          return this.executeDelete(chatId, 'file', fileId, parentFolderId, messageId);
        }

        // Delete confirmation: del_confirm:folder:<folderId>
        if (data.startsWith('del_confirm:folder:')) {
          const folderId = data.replace('del_confirm:folder:', '');
          await this.bot.answerCallbackQuery(query.id, { text: 'Deleting folder...' });
          return this.executeDelete(chatId, 'folder', folderId, 'root', messageId);
        }

        // Close / dismiss message
        if (data === 'dismiss_msg') {
          await this.bot.answerCallbackQuery(query.id);
          if (messageId) {
            return this.bot.deleteMessage(chatId, messageId).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Error handling callback query:', err);
        await this.bot.answerCallbackQuery(query.id, {
          text: '❌ An error occurred processing your request.',
          show_alert: true
        });
      }
    });
  }

  // --- Core Feature Logic ---

  // 1. Search Torrents and format response
  async executeTorrentSearch(chatId, query) {
    const statusMsg = await this.bot.sendMessage(chatId, `🔍 Searching for <i>"${escapeHtml(query)}"</i>...`, {
      parse_mode: 'HTML'
    });

    try {
      const results = await searchService.search(query);

      if (!results || results.length === 0) {
        return this.bot.editMessageText(`❌ No torrents found for <i>"${escapeHtml(query)}"</i>. Try another keyword.`, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'HTML'
        });
      }

      // Limit results to top 6 for clean readability in Telegram
      const topResults = results.slice(0, 6);
      let responseText = `🔍 <b>Search Results for:</b> <i>"${escapeHtml(query)}"</i>\n\n`;

      const inlineKeyboard = [];

      topResults.forEach((t, idx) => {
        const itemNumber = idx + 1;
        responseText += `<b>${itemNumber}. ${escapeHtml(t.title)}</b>\n`;
        responseText += `   📦 <b>Size:</b> ${t.size} | 🟢 <b>Seeds:</b> ${t.seeds} | 🔴 <b>Peers:</b> ${t.leeches || 0}\n`;
        responseText += `   🏷️ <b>Provider:</b> ${t.provider}\n\n`;

        // Store magnet in actionCache
        const cacheId = storeActionData({ magnet: t.magnet, title: t.title });

        inlineKeyboard.push([
          {
            text: `➕ Add #${itemNumber} to Seedr (${t.size})`,
            callback_data: `add_res:${cacheId}`
          }
        ]);
      });

      inlineKeyboard.push([
        { text: '🔍 New Search', callback_data: 'cmd_search_prompt' },
        { text: '📁 Seedr Files', callback_data: 'nav_folder:root' }
      ]);

      await this.bot.editMessageText(responseText, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    } catch (error) {
      console.error('Bot search error:', error);
      await this.bot.editMessageText(`❌ Failed to search torrents: ${escapeHtml(error.message || 'Unknown error')}`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML'
      });
    }
  }

  // 2. Direct magnet link handler
  async handleDirectMagnet(chatId, magnet) {
    const title = extractMagnetName(magnet);
    return this.handleAddTorrent(chatId, magnet, title);
  }

  // 3. Add torrent to Seedr and start polling
  async handleAddTorrent(chatId, magnet, title) {
    const statusMsg = await this.bot.sendMessage(
      chatId,
      `⏳ Adding <b>${escapeHtml(title)}</b> to Seedr cloud...`,
      { parse_mode: 'HTML' }
    );

    try {
      const result = await seedrService.addMagnet(magnet);

      if (result.result === false || (result.result !== true && result.result !== 'success' && !result.id)) {
        const errMsg = result.error || result.message || 'Seedr rejected magnet link.';
        return this.bot.editMessageText(`❌ <b>Failed to add to Seedr:</b> ${escapeHtml(errMsg)}`, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'HTML'
        });
      }

      const transferId = result.id || result.transfer_id;
      const finalTitle = result.title || title;

      await this.bot.editMessageText(
        `✅ <b>Added to Seedr!</b>\n\n` +
        `🎬 <b>Name:</b> ${escapeHtml(finalTitle)}\n` +
        `🆔 <b>Transfer ID:</b> <code>${transferId}</code>\n` +
        `⏳ <i>Tracking download progress...</i>`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ View Transfers', callback_data: 'cmd_transfers' }],
              [{ text: '📁 View Seedr Files', callback_data: 'nav_folder:root' }]
            ]
          }
        }
      );

      // Start asynchronous progress tracking if transferId is available
      if (transferId) {
        this.trackTransferProgress(chatId, transferId, finalTitle);
      }
    } catch (error) {
      console.error('Bot add magnet error:', error);
      const errMsg = error.error || error.message || 'Failed to add magnet link.';
      await this.bot.editMessageText(`❌ <b>Error:</b> ${escapeHtml(errMsg)}`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML'
      });
    }
  }

  // Track progress of an active transfer in background
  async trackTransferProgress(chatId, transferId, title) {
    let attempts = 0;
    const maxAttempts = 40; // ~2 minutes polling
    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await seedrService.getTransferStatus(transferId);
        const progress = data.progress || 0;
        const status = data.status || 'downloading';

        if (progress >= 100 || status === 'finished') {
          clearInterval(interval);
          return this.bot.sendMessage(
            chatId,
            `🎉 <b>Torrent Download Complete!</b>\n\n` +
            `🎬 <b>Title:</b> ${escapeHtml(title)}\n` +
            `☁️ Ready in your Seedr cloud storage.`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📁 Open Seedr Files', callback_data: 'nav_folder:root' }]
                ]
              }
            }
          );
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (err) {
        // Transfer might have finished and moved to folder list
        clearInterval(interval);
      }
    }, 3500);
  }

  // 4. Display Folder & Files Explorer
  async displayFolder(chatId, folderId = 'root', messageId = null) {
    try {
      const isRoot = folderId === 'root' || !folderId;
      const targetId = isRoot ? null : folderId;
      const data = await seedrService.listFolder(targetId);

      const folders = data.folders || [];
      const files = data.files || [];
      const currentName = isRoot ? 'Root Storage' : (data.name || `Folder #${folderId}`);

      let headerText = `📁 <b>Seedr Cloud: ${escapeHtml(currentName)}</b>\n`;

      if (isRoot && data.space_used !== undefined && data.space_max !== undefined) {
        const used = data.space_used || 0;
        const max = data.space_max || 1;
        const percent = Math.min(100, (used / max) * 100);
        headerText += `💾 <b>Quota:</b> ${formatBytes(used)} / ${formatBytes(max)}\n`;
        headerText += `📊 ${renderProgressBar(percent)}\n`;
      }

      headerText += `\n`;

      if (folders.length === 0 && files.length === 0) {
        headerText += `<i>This folder is empty.</i>`;
      } else {
        headerText += `<b>Contents (${folders.length} folders, ${files.length} files):</b>\n`;
      }

      const inlineKeyboard = [];

      // Add folder buttons
      folders.forEach((f) => {
        const folderSize = f.size ? ` (${formatBytes(f.size)})` : '';
        inlineKeyboard.push([
          {
            text: `📁 ${f.name}${folderSize}`,
            callback_data: `nav_folder:${f.id}`
          }
        ]);
      });

      // Add file buttons
      files.forEach((file) => {
        const fileSize = file.size ? ` (${formatBytes(file.size)})` : '';
        inlineKeyboard.push([
          {
            text: `📄 ${file.name}${fileSize}`,
            callback_data: `view_file:${file.id}:${folderId}`
          }
        ]);
      });

      // Navigation & action buttons at bottom
      const bottomNavRow = [];
      if (!isRoot) {
        bottomNavRow.push({ text: '⬅️ Back to Root', callback_data: 'nav_folder:root' });
        bottomNavRow.push({ text: '🗑️ Delete Folder', callback_data: `del_prompt:folder:${folderId}` });
      }
      bottomNavRow.push({ text: '🔄 Refresh', callback_data: `nav_folder:${folderId}` });

      inlineKeyboard.push(bottomNavRow);
      inlineKeyboard.push([
        { text: '🔍 Search Torrents', callback_data: 'cmd_search_prompt' },
        { text: '⚡ Active Transfers', callback_data: 'cmd_transfers' }
      ]);

      if (messageId) {
        await this.bot.editMessageText(headerText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } else {
        await this.bot.sendMessage(chatId, headerText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }
    } catch (error) {
      console.error('Display folder error:', error);
      const errMsg = `❌ Failed to list folder contents: ${escapeHtml(error.message || 'Unknown error')}`;
      if (messageId) {
        await this.bot.editMessageText(errMsg, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
      } else {
        await this.bot.sendMessage(chatId, errMsg, { parse_mode: 'HTML' });
      }
    }
  }

  // 5. Display File Details with Download / Delete buttons
  async displayFileDetails(chatId, fileId, parentFolderId = 'root', messageId = null) {
    try {
      const isRoot = parentFolderId === 'root';
      const folderData = await seedrService.listFolder(isRoot ? null : parentFolderId);
      const files = folderData.files || [];
      const file = files.find((f) => String(f.id) === String(fileId));

      const fileName = file ? file.name : `File #${fileId}`;
      const fileSize = file && file.size ? formatBytes(file.size) : 'Unknown';

      const text = 
        `📄 <b>File Details:</b>\n\n` +
        `🎬 <b>Name:</b> <code>${escapeHtml(fileName)}</code>\n` +
        `📦 <b>Size:</b> ${fileSize}\n` +
        `🆔 <b>File ID:</b> <code>${fileId}</code>\n\n` +
        `<i>Choose an action:</i>`;

      const inlineKeyboard = [
        [
          { text: '📥 Get Direct Download Link', callback_data: `get_dl:${fileId}:${parentFolderId}` }
        ],
        [
          { text: '🗑️ Delete File', callback_data: `del_prompt:file:${fileId}:${parentFolderId}` },
          { text: '⬅️ Back to Folder', callback_data: `nav_folder:${parentFolderId}` }
        ]
      ];

      if (messageId) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } else {
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }
    } catch (error) {
      console.error('Display file error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to retrieve file details: ${escapeHtml(error.message || '')}`, {
        parse_mode: 'HTML'
      });
    }
  }

  // 6. Generate Direct Download Link
  async generateFileDownloadLink(chatId, fileId, parentFolderId = 'root', messageId = null) {
    try {
      const result = await seedrService.getDownloadUrl(fileId);
      const downloadUrl = result.url;

      if (!downloadUrl) {
        throw new Error('Seedr did not return a valid download URL.');
      }

      const text = 
        `🚀 <b>High-Speed Direct Download Link Ready:</b>\n\n` +
        `🔗 <b>URL:</b> <a href="${escapeHtml(downloadUrl)}">Click here to Download / Stream</a>\n\n` +
        `<i>You can stream with VLC or download with your browser / download manager.</i>`;

      const inlineKeyboard = [
        [
          { text: '📥 Open / Download URL', url: downloadUrl }
        ],
        [
          { text: '⬅️ Back to File', callback_data: `view_file:${fileId}:${parentFolderId}` },
          { text: '📁 Back to Folder', callback_data: `nav_folder:${parentFolderId}` }
        ]
      ];

      if (messageId) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } else {
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }
    } catch (error) {
      console.error('Get download URL error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to get download link: ${escapeHtml(error.message || '')}`, {
        parse_mode: 'HTML'
      });
    }
  }

  // 7. Delete Confirmation Prompt
  async displayDeleteConfirmation(chatId, type, id, parentFolderId = 'root', messageId = null) {
    const text = 
      `⚠️ <b>Confirm Deletion</b>\n\n` +
      `Are you sure you want to permanently delete this ${type} from your Seedr cloud storage?\n` +
      `<i>This action cannot be undone.</i>`;

    const inlineKeyboard = [
      [
        { text: '✅ Yes, Delete', callback_data: `del_confirm:${type}:${id}:${parentFolderId}` },
        { text: '❌ Cancel', callback_data: type === 'file' ? `view_file:${id}:${parentFolderId}` : `nav_folder:${id}` }
      ]
    ];

    if (messageId) {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    } else {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }
  }

  // 8. Execute Deletion
  async executeDelete(chatId, type, id, parentFolderId = 'root', messageId = null) {
    try {
      if (type === 'folder') {
        await seedrService.deleteFolder(id);
      } else {
        await seedrService.deleteFile(id);
      }

      await this.bot.answerCallbackQuery ? this.bot.answerCallbackQuery(null) : null;
      await this.bot.sendMessage(chatId, `🗑️ <b>${type.toUpperCase()} deleted successfully from Seedr.</b>`, {
        parse_mode: 'HTML'
      });

      // Navigate back to parent folder
      return this.displayFolder(chatId, parentFolderId, messageId);
    } catch (error) {
      console.error('Delete error:', error);
      await this.bot.sendMessage(chatId, `❌ Failed to delete ${type}: ${escapeHtml(error.message || '')}`, {
        parse_mode: 'HTML'
      });
    }
  }

  // 9. Display Active Transfers
  async displayActiveTransfers(chatId, messageId = null) {
    try {
      const rootData = await seedrService.listFolder();
      const transfers = rootData.transfers || [];

      let text = `⚡ <b>Active Seedr Cloud Transfers:</b>\n\n`;

      if (transfers.length === 0) {
        text += `<i>No active transfers downloading right now.</i>\n\n` +
                `Paste a magnet link or use <code>/search</code> to add torrents!`;
      } else {
        transfers.forEach((t, idx) => {
          const progress = t.progress || 0;
          const status = t.status || 'downloading';
          text += `<b>${idx + 1}. ${escapeHtml(t.name || t.title || 'Torrent')}</b>\n`;
          text += `   📊 ${renderProgressBar(progress)}\n`;
          text += `   ⚡ <b>Status:</b> <code>${status}</code> | 🆔 <code>${t.id}</code>\n\n`;
        });
      }

      const inlineKeyboard = [
        [
          { text: '🔄 Refresh Status', callback_data: 'cmd_transfers' },
          { text: '📁 Seedr Files', callback_data: 'nav_folder:root' }
        ],
        [
          { text: '🔍 Search Torrents', callback_data: 'cmd_search_prompt' }
        ]
      ];

      if (messageId) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } else {
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }
    } catch (error) {
      console.error('Active transfers error:', error);
      const errMsg = `❌ Failed to fetch transfers: ${escapeHtml(error.message || '')}`;
      if (messageId) {
        await this.bot.editMessageText(errMsg, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
      } else {
        await this.bot.sendMessage(chatId, errMsg, { parse_mode: 'HTML' });
      }
    }
  }

  // 10. Display Storage Quota
  async displayStorageQuota(chatId, messageId = null) {
    try {
      const rootData = await seedrService.listFolder();
      const used = rootData.space_used || 0;
      const max = rootData.space_max || 1;
      const percent = Math.min(100, (used / max) * 100);
      const free = Math.max(0, max - used);

      const text = 
        `💾 <b>Seedr Cloud Storage Quota</b>\n\n` +
        `📦 <b>Used:</b> ${formatBytes(used)} (${percent.toFixed(1)}%)\n` +
        `🆓 <b>Free:</b> ${formatBytes(free)}\n` +
        `📊 <b>Total Capacity:</b> ${formatBytes(max)}\n\n` +
        `<b>Usage:</b>\n${renderProgressBar(percent, 12)}`;

      const inlineKeyboard = [
        [
          { text: '📁 Browse Files', callback_data: 'nav_folder:root' },
          { text: '🔄 Refresh Quota', callback_data: 'cmd_quota' }
        ]
      ];

      if (messageId) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } else {
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }
    } catch (error) {
      console.error('Storage quota error:', error);
      const errMsg = `❌ Failed to fetch storage quota: ${escapeHtml(error.message || '')}`;
      if (messageId) {
        await this.bot.editMessageText(errMsg, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
      } else {
        await this.bot.sendMessage(chatId, errMsg, { parse_mode: 'HTML' });
      }
    }
  }
}

const telegramBotInstance = new SeedrTelegramBot();
module.exports = telegramBotInstance;
