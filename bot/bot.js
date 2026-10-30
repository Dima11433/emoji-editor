/**
 * MAGNAT Emoji Studio — Telegram Bot Server
 * Autonomous Telegram Bot with Telegram Mini App (TMA) & Telegram Stars Integration.
 * Zero external dependencies (runs with standard Node.js https).
 *
 * HOW TO RUN:
 *   node bot/bot.js
 */

const https = require('https');
const http = require('http');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9138718385:AAGs-H7KUADtf2_QlU1ukIsKeEl6icd8y58';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://emoji-editor-ten.vercel.app';
const PORT = process.env.PORT || 3200;

/**
 * Call Telegram Bot API
 */
function api(method, data = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Invalid JSON: ${body}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Handle incoming updates
 */
async function handleUpdate(update) {
  // Pre-checkout query for Telegram Stars payments
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    console.log(`[STARS] Подтверждение платежа от @${query.from.username} (${query.total_amount} XTR)`);
    await api('answerPreCheckoutQuery', {
      pre_checkout_query_id: query.id,
      ok: true,
    });
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // Successful payment notification
  if (msg.successful_payment) {
    const sp = msg.successful_payment;
    console.log(`[PAYMENT SUCCESS] Пользователь ${msg.from.id} оплатил ${sp.total_amount} XTR!`);
    await api('sendMessage', {
      chat_id: chatId,
      text:
        `🎉 *Поздравляем с покупкой MAGNAT PRO!*\n\n` +
        `⭐️ Получено: *${sp.total_amount} Stars*\n` +
        `👑 Все 284 анимированных шаблона, мульти-редактирование и экспорт в @Stickers разблокированы!\n\n` +
        `Откройте редактор по кнопке ниже и создавайте свои уникальные наборы:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть MAGNAT Emoji Studio (PRO)',
              web_app: { url: WEB_APP_URL },
            },
          ],
        ],
      },
    });
    return;
  }

  if (text.startsWith('/start')) {
    const firstName = msg.from.first_name || 'друг';
    await api('sendMessage', {
      chat_id: chatId,
      text:
        `👋 Привет, *${firstName}*!\n\n` +
        `Добро пожаловать в *MAGNAT Emoji Studio* — профессиональный редактор и генератор анимированных .tgs эмодзи и стикеров для Telegram!\n\n` +
        `🔥 *Что умеет редактор:*\n` +
        `• 284 готовых анимированных шаблона (персонажи, подарки, любовь, 3D значки)\n` +
        `• Замена надписей вашим никнеймом, каналом или брендом на лету\n` +
        `• Векторизация и загрузка вашего логотипа прямо в слои эмодзи\n` +
        `• Мульти-редактирование до 60 эмодзи одновременно в 1 клик\n` +
        `• Готовый экспорт в .tgs и .zip для официального бота @Stickers\n\n` +
        `Нажмите кнопку ниже, чтобы запустить редактор прямо в Telegram:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎨 Открыть Emoji Studio',
              web_app: { url: WEB_APP_URL },
            },
          ],
          [
            {
              text: '👑 Купить MAGNAT PRO (290 ⭐️)',
              callback_data: 'buy_pro_stars',
            },
            {
              text: '💎 Lifetime VIP (890 ⭐️)',
              callback_data: 'buy_vip_stars',
            },
          ],
        ],
      },
    });
    return;
  }

  if (text.startsWith('/editor')) {
    await api('sendMessage', {
      chat_id: chatId,
      text: `🚀 Запускайте веб-редактор MAGNAT Emoji Studio по кнопке ниже:`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎨 Запустить редактор',
              web_app: { url: WEB_APP_URL },
            },
          ],
        ],
      },
    });
    return;
  }

  if (text.startsWith('/pro')) {
    await sendStarsInvoice(chatId, 'pro');
    return;
  }

  if (text.startsWith('/vip')) {
    await sendStarsInvoice(chatId, 'vip');
    return;
  }

  if (text.startsWith('/help')) {
    await api('sendMessage', {
      chat_id: chatId,
      text:
        `📖 *Инструкция по публикации пака в Telegram:*\n\n` +
        `1. Откройте *MAGNAT Emoji Studio* и настройте ваши эмодзи.\n` +
        `2. Скачайте .tgs файлы или готовый .zip архив пака.\n` +
        `3. Перейдите в официальный бот @Stickers.\n` +
        `4. Отправьте команду \`/newemojis\` (для эмодзи) или \`/newanimated\` (для стикеров).\n` +
        `5. Отправьте ваши скачанные файлы.\n\n` +
        `⭐️ Команды бота:\n` +
        `/start — Главное меню и запуск приложения\n` +
        `/editor — Открыть веб-редактор\n` +
        `/pro — Оплата месячной подписки PRO за Stars\n` +
        `/vip — Оплата вечной подписки Lifetime VIP за Stars`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎨 Открыть редактор',
              web_app: { url: WEB_APP_URL },
            },
          ],
        ],
      },
    });
  }
}

/**
 * Send Telegram Stars invoice
 */
async function sendStarsInvoice(chatId, planType = 'pro') {
  const isVip = planType === 'vip';
  const title = isVip ? 'MAGNAT LIFETIME VIP' : 'MAGNAT PRO · 30 дней';
  const description = isVip
    ? 'Полный пожизненный доступ ко всем 284 шаблонам, обновлениям и мульти-экспорту без ограничений'
    : 'Месячный доступ ко всем 284 шаблонам, мульти-редактированию и векторным логотипам';
  const starsAmount = isVip ? 890 : 290;

  await api('sendInvoice', {
    chat_id: chatId,
    title,
    description,
    payload: `sub_${planType}_${chatId}_${Date.now()}`,
    provider_token: '', // Must be empty string for Telegram Stars (XTR)
    currency: 'XTR',
    prices: [{ label: title, amount: starsAmount }],
  });
}

// Handle callback queries
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const data = cb.data;

  if (data === 'buy_pro_stars') {
    await sendStarsInvoice(chatId, 'pro');
  } else if (data === 'buy_vip_stars') {
    await sendStarsInvoice(chatId, 'vip');
  }

  await api('answerCallbackQuery', { callback_query_id: cb.id });
}

/**
 * Long Polling Loop
 */
let lastOffset = 0;
async function pollUpdates() {
  try {
    const res = await api('getUpdates', {
      offset: lastOffset,
      timeout: 25,
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
    });

    if (res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        lastOffset = update.update_id + 1;
        if (update.callback_query) {
          await handleCallback(update.callback_query).catch(console.error);
        } else {
          await handleUpdate(update).catch(console.error);
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
    await new Promise((r) => setTimeout(r, 4000));
  }
  setImmediate(pollUpdates);
}

/**
 * Health check & Webhook HTTP server
 */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'ok', service: 'MAGNAT Emoji Bot', webAppUrl: WEB_APP_URL }));
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const update = JSON.parse(body);
        await handleUpdate(update);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Initialize bot settings in Telegram
async function initBot() {
  try {
    const me = await api('getMe');
    if (me.ok) {
      console.log(`🤖 Бот авторизован: @${me.result.username} (${me.result.first_name})`);
    }

    await api('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: '🎨 Открыть редактор',
        web_app: { url: WEB_APP_URL },
      },
    });
    console.log('✅ Menu Button установлена на:', WEB_APP_URL);

    await api('setMyCommands', {
      commands: [
        { command: 'start', description: 'Запустить MAGNAT Studio' },
        { command: 'editor', description: 'Открыть веб-редактор' },
        { command: 'pro', description: 'Подписка PRO (Stars)' },
        { command: 'vip', description: 'Lifetime VIP (Stars)' },
        { command: 'help', description: 'Инструкция по загрузке в @Stickers' },
      ],
    });
  } catch (err) {
    console.error('Ошибка инициализации настроек бота:', err.message);
  }
}

// Start
initBot().then(() => {
  console.log('🚀 MAGNAT Telegram Bot запущен!');
  console.log(`🔗 WebApp URL: ${WEB_APP_URL}`);
  pollUpdates();
  server.listen(PORT, () => {
    console.log(`📡 HTTP Server слушает на порту ${PORT}`);
  });
});
