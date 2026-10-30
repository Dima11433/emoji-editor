/**
 * MAGNAT Emoji Studio — Telegram Bot Server & Admin Panel
 * Autonomous Telegram Bot with Telegram Mini App (TMA), Telegram Stars, CryptoBot
 * and Full Interactive Admin Panel with Telegram Premium Custom Emoji System.
 *
 * HOW TO RUN:
 *   node bot/bot.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9138718385:AAGs-H7KUADtf2_QlU1ukIsKeEl6icd8y58';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://emoji-editor-ten.vercel.app';
const PORT = process.env.PORT || 3200;

// Telegram Custom Emoji ID mapping from verified pack @ggg468q (Magnat_Projects_by_TgEmodziBot)
const PREMIUM_EMOJI_IDS = {
  '👤': '5348518843813770483',
  '🧾': '5348537930648431597',
  '💳': '5345814332972246451',
  '👥': '5345998604249115557',
  '🏷': '5348264306871939588',
  '🏷️': '5348264306871939588',
  '🏠': '5348274065037638049',
  '🛍': '5348114996628862520',
  '🛒': '5348114996628862520',
  '👑': '5348546503403152341',
  '⚡': '5346173125950220554',
  '⚡️': '5346173125950220554',
  '📱': '5348095484592434593',
  '🎨': '5345837014694539700',
  '🎬': '5345831225078625934',
  '💎': '5348270779387653031',
  '📩': '5348173442543823022',
  '✉️': '5348173442543823022',
  '✉': '5348173442543823022',
  '🔄': '5348047763210809216',
  '📁': '5348415511195593345',
  '📂': '5348415511195593345',
  '📄': '5348499945957666265',
  '🔐': '5346069209216494408',
  '🔒': '5346069209216494408',
  '🔓': '5346069209216494408',
  '✅': '5348031644198547469',
  '✔️': '5348031644198547469',
  '✔': '5348031644198547469',
  '❌': '5346291379284783222',
  '🗑': '5345964235920815032',
  '🗑️': '5345964235920815032',
  '⬅️': '5348427184916702612',
  '⬅': '5348427184916702612',
  '◀️': '5348427184916702612',
  '◀': '5348427184916702612',
  '🔙': '5348427184916702612',
  '➡️': '5348076518016853385',
  '➡': '5348076518016853385',
  '▶️': '5348076518016853385',
  '▶': '5348076518016853385',
  '➕': '5346175084455306034',
  '➖': '5345780535874596347',
  '💰': '5348373162818055391',
  '💵': '5348373162818055391',
  '💸': '5348373162818055391',
  '📢': '5348552112630440282',
  '📣': '5348552112630440282',
  '🔗': '5348394358481659680',
  '🤝': '5348274266901096191',
  '🎁': '5345864369341245455',
  '⏳': '5345848413537742001',
  '⚠️': '5346201270870911149',
  '⚠': '5346201270870911149',
  '❗️': '5345792072156752991',
  '❗': '5345792072156752991',
  '✏️': '5345837014694539700',
  '✏': '5345837014694539700',
  '✍️': '5345837014694539700',
  '✍': '5345837014694539700',
  '🔍': '5346127719555967816',
  '🔎': '5346127719555967816',
  '⚙️': '5345883542075254736',
  '⚙': '5345883542075254736',
  '🛠': '5345883542075254736',
  '🛠️': '5345883542075254736',
  '🌐': '5348394358481659680',
  '🛡': '5345898338237588903',
  '🛡️': '5345898338237588903',
  '⛔️': '5345780535874596347',
  '⛔': '5345780535874596347',
  '🛑': '5345780535874596347',
  '🚫': '5345780535874596347',
  '💬': '5345891380390571206',
  '🎉': '5345805262001318118',
  '⭐': '5345938710930174214',
  '⭐️': '5345938710930174214',
  '🌟': '5345938710930174214',
  '✨': '5345938710930174214',
  '🏆': '5345824258641669124',
  '🔥': '5345958046872939339',
  '💯': '5345805262001318118',
  '🔝': '5348475825421330256',
  '🆕': '5348301119036633590',
  '📅': '5348041522623325063',
  '⏰': '5348297872041358291',
  '⏱': '5348297872041358291',
  '⏱️': '5348297872041358291',
  '❓': '5348556347468198125',
  '👋': '5348274266901096191',
  '👍': '5348502149275887319',
  '👎': '5346291379284783222',
  '💼': '5348415511195593345',
  '👛': '5345814332972246451',
  '🚀': '5345919916153280274',
  '💡': '5348167167596608202',
  '📖': '5348348209058065192',
  '📚': '5348348209058065192',
  '📜': '5348537930648431597',
  '📦': '5348415511195593345',
  '📈': '5348394938302245147',
  '📊': '5348394938302245147',
  '📋': '5348537930648431597',
  '📎': '5348394358481659680',
  '📝': '5345837014694539700',
  'ℹ️': '5348348209058065192',
  'ℹ': '5348348209058065192',
  '🆔': '5348518843813770483',
  '🤖': '5348502149275887319',
  '💻': '5348502149275887319',
  '🎯': '5348475825421330256',
};

// Sorted pattern for text substitution
const _EMOJI_PATTERN = new RegExp(
  Object.keys(PREMIUM_EMOJI_IDS)
    .sort((a, b) => b.length - a.length)
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g'
);

// Pattern for leading button icon
const _BUTTON_ICON_PATTERN = new RegExp(
  '^(' +
    Object.keys(PREMIUM_EMOJI_IDS)
      .sort((a, b) => b.length - a.length)
      .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')\\s*'
);

function premiumize(text) {
  if (!text || typeof text !== 'string') return text;
  // Protect existing <tg-emoji> blocks from nested replacements
  const parts = text.split(/(<tg-emoji[^>]*>.*?<\/tg-emoji>)/s);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(_EMOJI_PATTERN, (match) => {
      const id = PREMIUM_EMOJI_IDS[match];
      return id ? `<tg-emoji emoji-id="${id}">${match}</tg-emoji>` : match;
    });
  }
  return parts.join('');
}

function premiumizeButtons(keyboard) {
  if (!keyboard || !Array.isArray(keyboard)) return;
  for (const row of keyboard) {
    if (!Array.isArray(row)) continue;
    for (const btn of row) {
      if (!btn || !btn.text) continue;
      if (btn.icon_custom_emoji_id) continue;
      const match = btn.text.match(_BUTTON_ICON_PATTERN);
      if (match) {
        const emoji = match[1];
        const id = PREMIUM_EMOJI_IDS[emoji];
        if (id) {
          btn.icon_custom_emoji_id = id;
          const cleanText = btn.text.replace(_BUTTON_ICON_PATTERN, '').trim();
          btn.text = cleanText || btn.text;
        }
      }
    }
  }
}

// Premium Custom Emoji Helper (HTML mode)
const P = {
  crown: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['👑']}">👑</tg-emoji>`,
  star: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['⭐']}">⭐️</tg-emoji>`,
  sparkles: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['✨']}">✨</tg-emoji>`,
  fire: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['🔥']}">🔥</tg-emoji>`,
  palette: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['🎨']}">🎨</tg-emoji>`,
  rocket: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['🚀']}">🚀</tg-emoji>`,
  diamond: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['💎']}">💎</tg-emoji>`,
  lightning: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['⚡']}">⚡️</tg-emoji>`,
  chart: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['📊']}">📊</tg-emoji>`,
  users: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['👥']}">👥</tg-emoji>`,
  gift: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['🎁']}">🎁</tg-emoji>`,
  gear: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['⚙']}">⚙️</tg-emoji>`,
  broadcast: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['📢']}">📢</tg-emoji>`,
  shield: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['🛡']}">🛡</tg-emoji>`,
  check: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['✅']}">✅</tg-emoji>`,
  cross: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['❌']}">❌</tg-emoji>`,
  wave: `<tg-emoji emoji-id="${PREMIUM_EMOJI_IDS['👋']}">👋</tg-emoji>`,
};

// State store for admin interactive prompts (find user, broadcast message, etc.)
const adminSessions = {};

/**
 * Call Telegram Bot API with automatic recovery for entity/formatting errors
 */
function api(method, data = {}) {
  return new Promise((resolve, reject) => {
    // Clone data to avoid mutating caller references
    const outboundData = { ...data };

    // Apply premium custom emoji to text and caption
    if (outboundData.text && (outboundData.parse_mode === 'HTML' || !outboundData.parse_mode)) {
      outboundData.parse_mode = 'HTML';
      outboundData.text = premiumize(outboundData.text);
    }
    if (outboundData.caption && (outboundData.parse_mode === 'HTML' || !outboundData.parse_mode)) {
      outboundData.parse_mode = 'HTML';
      outboundData.caption = premiumize(outboundData.caption);
    }

    // Apply premium custom emoji icons to inline keyboard buttons
    if (outboundData.reply_markup && outboundData.reply_markup.inline_keyboard) {
      outboundData.reply_markup = JSON.parse(JSON.stringify(outboundData.reply_markup));
      premiumizeButtons(outboundData.reply_markup.inline_keyboard);
    }

    const payload = JSON.stringify(outboundData);
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
        res.on('end', async () => {
          try {
            const parsed = JSON.parse(body);
            if (!parsed.ok) {
              console.warn(`[Telegram API Error] ${method}: ${parsed.description}`);
              // Fallback: If Telegram complains about DOCUMENT_INVALID or entity parsing, strip tg-emoji
              if (
                (outboundData.text || outboundData.caption || outboundData.reply_markup) &&
                (parsed.description.includes('DOCUMENT_INVALID') ||
                  parsed.description.includes("can't parse entities"))
              ) {
                console.warn(`[Fallback] Retrying ${method} without custom emoji tags...`);
                const cleanData = { ...data };
                if (cleanData.text) {
                  cleanData.text = cleanData.text
                    .replace(/<tg-emoji[^>]*>/g, '')
                    .replace(/<\/tg-emoji>/g, '');
                }
                if (cleanData.caption) {
                  cleanData.caption = cleanData.caption
                    .replace(/<tg-emoji[^>]*>/g, '')
                    .replace(/<\/tg-emoji>/g, '');
                }
                if (cleanData.reply_markup && cleanData.reply_markup.inline_keyboard) {
                  cleanData.reply_markup = JSON.parse(JSON.stringify(cleanData.reply_markup));
                  for (const row of cleanData.reply_markup.inline_keyboard) {
                    for (const btn of row) {
                      delete btn.icon_custom_emoji_id;
                    }
                  }
                }
                try {
                  const retryRes = await api(method, cleanData);
                  return resolve(retryRes);
                } catch (err) {
                  return resolve(parsed);
                }
              }
            }
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
 * Send Document (e.g. backup file)
 */
function sendDocument(chatId, filePath, caption = '') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    const filename = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    let pre = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n` +
      `Content-Type: application/json\r\n\r\n`;

    let post = `\r\n--${boundary}--\r\n`;
    const fullBody = Buffer.concat([Buffer.from(pre), fileData, Buffer.from(post)]);

    const req = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length,
        },
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      }
    );
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

/**
 * Build Admin Main Menu Keyboard
 */
function getAdminMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 Статистика', callback_data: 'adm_stats' },
        { text: '👥 Пользователи', callback_data: 'adm_users' },
      ],
      [
        { text: '🎁 Промокоды', callback_data: 'adm_promos' },
        { text: '📢 Рассылка', callback_data: 'adm_broadcast_prompt' },
      ],
      [
        { text: '⚙️ Настройки и цены', callback_data: 'adm_settings' },
        { text: '💾 Скачать базу', callback_data: 'adm_backup' },
      ],
      [
        {
          text: '🚀 Открыть Studio (Супер-Админ)',
          web_app: { url: `${WEB_APP_URL}?admin=1` },
        },
      ],
      [
        { text: '❌ Закрыть панель', callback_data: 'adm_close' },
      ],
    ],
  };
}

/**
 * Send or Edit Admin Main Dashboard
 */
async function sendAdminDashboard(chatId, messageId = null) {
  const stats = db.getStats();
  const text =
    `${P.crown} <b>MAGNAT EMOJI STUDIO — ПАНЕЛЬ УПРАВЛЕНИЯ</b>\n\n` +
    `${P.lightning} <b>Статус системы:</b> ${stats.maintenance ? '🛑 ТЕХРАБОТЫ' : '🟢 АКТИВНА'}\n` +
    `${P.users} <b>Всего пользователей:</b> <code>${stats.total_users}</code>\n` +
    `${P.fire} <b>Активных за 24 часа:</b> <code>${stats.active_today}</code>\n` +
    `${P.star} <b>Заработано Stars:</b> <code>${stats.total_stars} ⭐️</code> (~${Math.round(stats.total_stars * 1.2)} ₽)\n` +
    `${P.diamond} <b>Платных подписчиков:</b> <code>${stats.paid_users}</code>\n` +
    `${P.rocket} <b>Всего запусков Studio:</b> <code>${stats.total_launches}</code>\n\n` +
    `<i>Выберите раздел для управления ботом и тарифами:</i>`;

  const keyboard = getAdminMenuKeyboard();

  if (messageId) {
    await api('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }).catch(async () => {
      await api('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    });
  } else {
    await api('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
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
  const userId = msg.from.id;
  const text = (msg.text || '').trim();
  console.log(`[BOT MSG] From ${userId} (@${msg.from.username || msg.from.first_name || ''}): "${text}"`);

  // Track and register user in database
  const user = db.upsertUser(msg.from);

  // Check Maintenance
  const settings = db.getSettings();
  if (settings.maintenance && !db.isAdmin(userId) && !text.startsWith('/admin')) {
    await api('sendMessage', {
      chat_id: chatId,
      text: `${P.gear} <b>Сервис на кратковременном техническом обслуживании.</b>\n\nМы обновляем базу шаблонов MAGNAT. Попробуйте снова через 10 минут!`,
      parse_mode: 'HTML',
    });
    return;
  }

  // Handle Admin Interactive Prompts
  if (adminSessions[userId]) {
    const session = adminSessions[userId];

    if (text === '/cancel' || text === 'Отмена') {
      delete adminSessions[userId];
      await api('sendMessage', {
        chat_id: chatId,
        text: '❌ Действие отменено.',
        reply_markup: { remove_keyboard: true },
      });
      await sendAdminDashboard(chatId);
      return;
    }

    if (session.action === 'find_user') {
      delete adminSessions[userId];
      const found = db.findUser(text);
      if (!found) {
        await api('sendMessage', {
          chat_id: chatId,
          text: `❌ Пользователь «${text}» не найден в базе бота.`,
          reply_markup: {
            inline_keyboard: [[{ text: '◀️ Назад в админку', callback_data: 'adm_menu' }]],
          },
        });
        return;
      }

      await api('sendMessage', {
        chat_id: chatId,
        text:
          `${P.users} <b>Пользователь:</b> ${found.first_name} ${found.username ? `(@${found.username})` : ''}\n` +
          `🆔 ID: <code>${found.id}</code>\n` +
          `${P.crown} Тариф: <b>${found.plan.toUpperCase()}</b>\n` +
          `${P.sparkles} Баланс генераций: <b>${found.generations}</b>\n` +
          `⭐️ Потрачено: <b>${found.total_spent_stars} Stars</b> | <b>${found.total_spent_rub} ₽</b>\n` +
          `📅 Регистрация: <code>${found.joined_at.slice(0, 10)}</code>\n` +
          `🕒 Активность: <code>${found.last_active.slice(0, 16).replace('T', ' ')}</code>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👑 Выдать PRO (30д)', callback_data: `adm_grant_${found.id}_pro` },
              { text: '💎 Выдать VIP Lifetime', callback_data: `adm_grant_${found.id}_vip` },
            ],
            [
              { text: '⚡️ +50 генераций', callback_data: `adm_addgen_${found.id}_50` },
              { text: '⚡️ +200 генераций', callback_data: `adm_addgen_${found.id}_200` },
            ],
            [
              { text: '🚫 Обнулить тариф', callback_data: `adm_grant_${found.id}_free` },
              { text: '◀️ В админку', callback_data: 'adm_menu' },
            ],
          ],
        },
      });
      return;
    }

    if (session.action === 'broadcast_text') {
      delete adminSessions[userId];
      const allUsers = db.getAllUsers();
      let sent = 0;
      let failed = 0;

      await api('sendMessage', {
        chat_id: chatId,
        text: `${P.broadcast} <b>Запуск рассылки на ${allUsers.length} пользователей...</b>`,
        parse_mode: 'HTML',
      });

      for (const target of allUsers) {
        try {
          await api('sendMessage', {
            chat_id: target.id,
            text: text,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🎨 Открыть MAGNAT Emoji Studio',
                    web_app: { url: WEB_APP_URL },
                  },
                ],
              ],
            },
          });
          sent++;
          await new Promise(r => setTimeout(r, 40));
        } catch (e) {
          failed++;
        }
      }

      await api('sendMessage', {
        chat_id: chatId,
        text:
          `${P.check} <b>Рассылка завершена!</b>\n\n` +
          `✅ Успешно доставлено: <b>${sent}</b>\n` +
          `❌ Не доставлено (бот заблокирован): <b>${failed}</b>`,
        parse_mode: 'HTML',
        reply_markup: getAdminMenuKeyboard(),
      });
      return;
    }

    if (session.action === 'create_promo_custom') {
      delete adminSessions[userId];
      const code = text.trim().toUpperCase();
      const created = db.createPromo({
        code,
        type: 'generations',
        value: 50,
        max_activations: 100,
      });

      await api('sendMessage', {
        chat_id: chatId,
        text: `${P.check} Промокод <code>${created.code}</code> на <b>50 генераций</b> (100 активаций) успешно создан!`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '◀️ К промокодам', callback_data: 'adm_promos' }]],
        },
      });
      return;
    }
  }

  // Successful payment notification
  if (msg.successful_payment) {
    const sp = msg.successful_payment;
    console.log(`[PAYMENT SUCCESS] Пользователь ${msg.from.id} оплатил ${sp.total_amount} XTR!`);
    db.recordPayment(userId, sp.total_amount, 0);

    // Grant appropriate plan based on payload
    if (sp.invoice_payload.includes('vip')) {
      db.grantPlan(userId, 'vip');
    } else {
      db.grantPlan(userId, 'pro', 30);
    }

    await api('sendMessage', {
      chat_id: chatId,
      text:
        `🎉 <b>Поздравляем с покупкой MAGNAT PRO!</b>\n\n` +
        `${P.star} Получено: <b>${sp.total_amount} Stars</b>\n` +
        `${P.crown} Все 284 анимированных шаблона, мульти-редактирование и экспорт в @Stickers разблокированы!\n\n` +
        `Откройте редактор по кнопке ниже и создавайте свои уникальные наборы:`,
      parse_mode: 'HTML',
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

  // /admin Command
  if (text.startsWith('/admin')) {
    if (!db.isAdmin(userId)) {
      // Secret bootstrap key
      if (text.includes('magnat2026') || text.includes('admin777')) {
        db.addAdmin(userId);
        await api('sendMessage', {
          chat_id: chatId,
          text: `${P.check} <b>Вы успешно авторизованы как Администратор!</b>`,
          parse_mode: 'HTML',
        });
      } else {
        await api('sendMessage', {
          chat_id: chatId,
          text: `⛔ <b>Доступ запрещён.</b>\nВаш ID <code>${userId}</code> не найден в списке администраторов.`,
          parse_mode: 'HTML',
        });
        return;
      }
    }

    await sendAdminDashboard(chatId);
    return;
  }

  if (text.startsWith('/start')) {
    const firstName = msg.from.first_name || 'друг';
    const isAdminUser = db.isAdmin(userId);

    const mainKeyboard = [
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
    ];

    if (isAdminUser) {
      mainKeyboard.push([
        {
          text: '👑 Панель Администратора',
          callback_data: 'adm_menu',
        },
      ]);
    }

    await api('sendMessage', {
      chat_id: chatId,
      text:
        `👋 Привет, <b>${firstName}</b>!\n\n` +
        `Добро пожаловать в <b>MAGNAT Emoji Studio</b> — профессиональный редактор и генератор анимированных .tgs эмодзи и стикеров для Telegram!\n\n` +
        `${P.fire} <b>Что умеет редактор:</b>\n` +
        `• <b>284 готовых шаблона</b> (персонажи, подарки, любовь, 3D значки)\n` +
        `• Замена надписей вашим никнеймом, каналом или брендом на лету\n` +
        `• Векторизация и загрузка вашего логотипа прямо в слои эмодзи\n` +
        `• Мульти-редактирование до 60 эмодзи одновременно в 1 клик\n` +
        `• Готовый экспорт в .tgs и .zip для официального бота @Stickers\n\n` +
        `Нажмите кнопку ниже, чтобы запустить редактор прямо в Telegram:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: mainKeyboard,
      },
    });
    return;
  }

  if (text.startsWith('/editor')) {
    await api('sendMessage', {
      chat_id: chatId,
      text: `${P.rocket} <b>Запускайте веб-редактор MAGNAT Emoji Studio:</b>`,
      parse_mode: 'HTML',
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
        `📖 <b>Инструкция по публикации пака в Telegram:</b>\n\n` +
        `1. Откройте <b>MAGNAT Emoji Studio</b> и настройте ваши эмодзи.\n` +
        `2. Скачайте .tgs файлы или готовый .zip архив пака.\n` +
        `3. Перейдите в официальный бот @Stickers.\n` +
        `4. Отправьте команду <code>/newemojis</code> (для эмодзи) или <code>/newanimated</code> (для стикеров).\n` +
        `5. Отправьте ваши скачанные файлы.\n\n` +
        `⭐️ <b>Команды бота:</b>\n` +
        `/start — Главное меню и запуск приложения\n` +
        `/editor — Открыть веб-редактор\n` +
        `/pro — Оплата месячной подписки PRO за Stars\n` +
        `/vip — Оплата вечной подписки Lifetime VIP за Stars\n` +
        `/admin — Панель администратора (только для админов)`,
      parse_mode: 'HTML',
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

/**
 * Handle callback queries (including full Admin Panel navigation)
 */
async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const userId = cb.from?.id;
  const data = cb.data;
  console.log(`[BOT CALLBACK] From ${userId}: "${data}"`);

  // Answer callback right away to stop spinner
  await api('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});

  // Standard user buttons
  if (data === 'buy_pro_stars') {
    return sendStarsInvoice(chatId, 'pro');
  }
  if (data === 'buy_vip_stars') {
    return sendStarsInvoice(chatId, 'vip');
  }

  // --- ADMIN PANEL ROUTING ---
  if (!db.isAdmin(userId)) {
    return api('sendMessage', {
      chat_id: chatId,
      text: '⛔ У вас нет доступа к административным функциям.',
    });
  }

  if (data === 'adm_menu') {
    return sendAdminDashboard(chatId, messageId);
  }

  if (data === 'adm_close') {
    await api('deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => {});
    return;
  }

  // 1. STATS
  if (data === 'adm_stats') {
    const stats = db.getStats();
    const text =
      `${P.chart} <b>ПОДРОБНАЯ АНАЛИТИКА MAGNAT STUDIO</b>\n\n` +
      `👥 Всего зарегистрировано: <b>${stats.total_users}</b>\n` +
      `🔥 Активных за последние 24ч: <b>${stats.active_today}</b>\n` +
      `💳 Пользователей с оплатой: <b>${stats.paid_users}</b>\n\n` +
      `<b>Разбивка по тарифам:</b>\n` +
      `• Free: <code>${stats.plans_breakdown.free}</code>\n` +
      `• Pro: <code>${stats.plans_breakdown.pro}</code>\n` +
      `• Pro+: <code>${stats.plans_breakdown.pro_plus}</code>\n` +
      `• Max: <code>${stats.plans_breakdown.max}</code>\n` +
      `• Редактор: <code>${stats.plans_breakdown.editor}</code>\n` +
      `• Lifetime VIP: <code>${stats.plans_breakdown.vip}</code>\n\n` +
      `<b>Выручка:</b>\n` +
      `⭐️ Stars: <b>${stats.total_stars} XTR</b> (~${Math.round(stats.total_stars * 1.2)} ₽)\n` +
      `🪙 Crypto / RUB: <b>${stats.total_rub} ₽</b>\n` +
      `🚀 Всего открытий студии: <b>${stats.total_launches}</b>`;

    await api('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Обновить', callback_data: 'adm_stats' }],
          [{ text: '◀️ Назад в админку', callback_data: 'adm_menu' }],
        ],
      },
    });
    return;
  }

  // 2. USERS
  if (data === 'adm_users') {
    const users = db.getAllUsers().slice(-6).reverse();
    let text = `${P.users} <b>УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ</b>\n\nПоследние зарегистрированные:\n`;

    users.forEach((u, idx) => {
      text += `${idx + 1}. <b>${u.first_name}</b> ${u.username ? `(@${u.username})` : ''} — <code>${u.id}</code>\n` +
        `   Тариф: <b>${u.plan.toUpperCase()}</b> | Ген: <b>${u.generations}</b>\n`;
    });

    text += `\n<i>Введите ник или ID для быстрого поиска и выдачи подписки:</i>`;

    await api('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Найти пользователя по @ / ID', callback_data: 'adm_find_prompt' }],
          [{ text: '◀️ Назад в админку', callback_data: 'adm_menu' }],
        ],
      },
    });
    return;
  }

  if (data === 'adm_find_prompt') {
    adminSessions[userId] = { action: 'find_user' };
    await api('sendMessage', {
      chat_id: chatId,
      text: `🔎 <b>Отправьте Telegram ID пользователя или @username:</b>\n\n<i>Для отмены отправьте /cancel</i>`,
      parse_mode: 'HTML',
    });
    return;
  }

  // Grant plan callback: adm_grant_<targetId>_<plan>
  if (data.startsWith('adm_grant_')) {
    const [, , targetId, plan] = data.split('_');
    db.grantPlan(targetId, plan, plan === 'vip' ? 36500 : 30);
    const u = db.getUser(targetId);

    await api('sendMessage', {
      chat_id: chatId,
      text: `${P.check} Пользователю <b>${u ? u.first_name : targetId}</b> успешно выдан тариф <b>${plan.toUpperCase()}</b>!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '◀️ В админку', callback_data: 'adm_menu' }]],
      },
    });

    // Notify user
    api('sendMessage', {
      chat_id: targetId,
      text: `${P.crown} <b>Администратор активировал вам тариф ${plan.toUpperCase()}!</b>\nОткройте MAGNAT Emoji Studio, все возможности разблокированы.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🚀 Открыть Studio', web_app: { url: WEB_APP_URL } }]],
      },
    }).catch(() => {});
    return;
  }

  // Add generations callback: adm_addgen_<targetId>_<count>
  if (data.startsWith('adm_addgen_')) {
    const [, , targetId, count] = data.split('_');
    db.addGenerations(targetId, count);
    const u = db.getUser(targetId);

    await api('sendMessage', {
      chat_id: chatId,
      text: `${P.check} Пользователю <b>${u ? u.first_name : targetId}</b> начислено <b>+${count} генераций</b>!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '◀️ В админку', callback_data: 'adm_menu' }]],
      },
    });

    api('sendMessage', {
      chat_id: targetId,
      text: `${P.sparkles} <b>Вам начислено +${count} бонусных генераций от администратора!</b>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🎨 Открыть Studio', web_app: { url: WEB_APP_URL } }]],
      },
    }).catch(() => {});
    return;
  }

  // 3. PROMOS
  if (data === 'adm_promos') {
    const promos = db.getPromos();
    let text = `${P.gift} <b>УПРАВЛЕНИЕ ПРОМОКОДАМИ</b>\n\nАктивные промокоды:\n`;

    promos.forEach((pr, i) => {
      text += `${i + 1}. <code>${pr.code}</code> — ${pr.type === 'generations' ? `+${pr.value} ген.` : `Тариф ${pr.value.toUpperCase()}`}\n` +
        `   Осталось активаций: <b>${pr.activations_left}</b> / ${pr.max_activations}\n`;
    });

    await api('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Промокод (+50 ген)', callback_data: 'adm_promo_add_50' },
            { text: '➕ Промокод (PRO 30д)', callback_data: 'adm_promo_add_pro' },
          ],
          [
            { text: '✍️ Свой промокод', callback_data: 'adm_promo_custom_prompt' },
          ],
          [{ text: '◀️ Назад в админку', callback_data: 'adm_menu' }],
        ],
      },
    });
    return;
  }

  if (data === 'adm_promo_add_50') {
    const code = 'GIFT' + Math.floor(1000 + Math.random() * 9000);
    db.createPromo({ code, type: 'generations', value: 50, max_activations: 100 });
    await api('sendMessage', {
      chat_id: chatId,
      text: `${P.check} Создан промокод <code>${code}</code> на <b>50 генераций</b> (100 активаций)!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '◀️ К промокодам', callback_data: 'adm_promos' }]],
      },
    });
    return;
  }

  if (data === 'adm_promo_add_pro') {
    const code = 'PRO' + Math.floor(1000 + Math.random() * 9000);
    db.createPromo({ code, type: 'plan', value: 'pro', days: 30, max_activations: 50 });
    await api('sendMessage', {
      chat_id: chatId,
      text: `${P.check} Создан промокод <code>${code}</code> на <b>PRO 30 дней</b> (50 активаций)!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '◀️ К промокодам', callback_data: 'adm_promos' }]],
      },
    });
    return;
  }

  if (data === 'adm_promo_custom_prompt') {
    adminSessions[userId] = { action: 'create_promo_custom' };
    await api('sendMessage', {
      chat_id: chatId,
      text: `✍️ <b>Отправьте название промокода:</b>\n(например: <code>MAGNAT_BONUS</code>)`,
      parse_mode: 'HTML',
    });
    return;
  }

  // 4. BROADCAST
  if (data === 'adm_broadcast_prompt') {
    const count = db.getAllUsers().length;
    adminSessions[userId] = { action: 'broadcast_text' };
    await api('sendMessage', {
      chat_id: chatId,
      text:
        `${P.broadcast} <b>МАССОВАЯ РАССЫЛКА</b>\n\n` +
        `Получателей в базе: <b>${count}</b> пользователей.\n\n` +
        `<i>Отправьте сообщение (текст, эмодзи, HTML-теги), которое нужно разослать всем пользователям бота:</i>\n\n` +
        `Для отмены отправьте /cancel`,
      parse_mode: 'HTML',
    });
    return;
  }

  // 5. SETTINGS
  if (data === 'adm_settings') {
    const s = db.getSettings();
    const text =
      `${P.gear} <b>НАСТРОЙКИ СИСТЕМЫ И ТАРИФОВ</b>\n\n` +
      `• Режим техработ: <b>${s.maintenance ? '🛑 ВКЛЮЧЁН' : '🟢 ВЫКЛЮЧЕН'}</b>\n` +
      `• Курс Stars: <b>1 ⭐️ = ${s.stars_rate} ₽</b>\n` +
      `• Поштучно (1 шт): <b>${s.price_per_piece} ₽</b>\n` +
      `• Опт (от 50 шт): <b>${s.price_per_piece_bulk} ₽</b>\n` +
      `• Стартовый пробный баланс: <b>${s.free_trial_generations} генераций</b>\n` +
      `• Админов в системе: <b>${db.getAdmins().length}</b>`;

    await api('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: s.maintenance ? '🟢 Отключить техработы' : '🛑 Включить техработы',
              callback_data: 'adm_toggle_maint',
            },
          ],
          [{ text: '◀️ Назад в админку', callback_data: 'adm_menu' }],
        ],
      },
    });
    return;
  }

  if (data === 'adm_toggle_maint') {
    const cur = db.getSettings().maintenance;
    db.updateSettings({ maintenance: !cur });
    await api('sendMessage', {
      chat_id: chatId,
      text: `${P.check} Режим техработ изменён на: <b>${!cur ? 'ВКЛЮЧЁН 🛑' : 'ВЫКЛЮЧЕН 🟢'}</b>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '◀️ К настройкам', callback_data: 'adm_settings' }]],
      },
    });
    return;
  }

  // 6. BACKUP
  if (data === 'adm_backup') {
    const dbPath = path.join(__dirname, 'db.json');
    if (fs.existsSync(dbPath)) {
      await sendDocument(chatId, dbPath, `${P.shield} Резервная копия базы данных MAGNAT Studio`);
    } else {
      await api('sendMessage', { chat_id: chatId, text: 'Файл базы данных пока пуст.' });
    }
    return;
  }
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
    return res.end(JSON.stringify({ status: 'ok', service: 'MAGNAT Emoji Bot & Admin Panel', webAppUrl: WEB_APP_URL }));
  }

  // Admin stats endpoint for TMA
  if (req.url === '/api/admin/stats') {
    res.writeHead(200);
    return res.end(JSON.stringify(db.getStats()));
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
        { command: 'admin', description: 'Панель администратора' },
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
  console.log(`👑 Администраторы: ${db.getAdmins().join(', ')}`);
  pollUpdates();
  server.listen(PORT, () => {
    console.log(`📡 HTTP Server слушает на порту ${PORT}`);
  });
});
