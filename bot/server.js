require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express     = require('express');
const cors        = require('cors');
const path = require('path');
const fs   = require('fs');

// ── Файловое хранилище страниц ────────────────────────────────
const PAGES_DIR = path.join(__dirname, 'pages');
if (!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR, { recursive: true });

function cleanupExpired() {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const file of fs.readdirSync(PAGES_DIR)) {
        if (!file.endsWith('.json')) continue;
        try {
            const d = JSON.parse(fs.readFileSync(path.join(PAGES_DIR, file), 'utf8'));
            if (d.createdAt < cutoff) { fs.unlinkSync(path.join(PAGES_DIR, file)); deleted++; }
        } catch(e) {}
    }
    if (deleted > 0) console.log(`🗑️  Удалено просроченных страниц: ${deleted}`);
}
cleanupExpired();
setInterval(cleanupExpired, 24 * 60 * 60 * 1000);

// ── Конфиг ───────────────────────────────────────────────────
const TOKEN         = process.env.BOT_TOKEN;
const PORT          = process.env.PORT || 3000;
const FRONTEND_URL  = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
const STARS_PRICE   = parseInt(process.env.STARS_PRICE) || 1;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? parseInt(process.env.ADMIN_CHAT_ID) : null;

if (!TOKEN) {
    console.error('❌ BOT_TOKEN не задан в .env файле!');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

const paidPayloads = new Map();

// ── Helpers ───────────────────────────────────────────────────
function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function notifyAdmin(html) {
    if (!ADMIN_CHAT_ID) return;
    bot.sendMessage(ADMIN_CHAT_ID, html, { parse_mode: 'HTML' }).catch(err => {
        console.error('❌ Уведомление админу:', err.message);
    });
}

function userInfo(msg) {
    const u = msg.from;
    if (!u) return 'неизвестный';
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    return u.username ? `${esc(name)} (@${esc(u.username)})` : `${esc(name)} [id: ${u.id}]`;
}

// ── Старт бота ────────────────────────────────────────────────
let botUsername = '';
bot.getMe().then(me => {
    botUsername = me.username;
    console.log(`✅ Бот запущен: @${botUsername}`);
    console.log(`⭐ Цена: ${STARS_PRICE} Star`);
    console.log(`🌐 Сервер: http://localhost:${PORT}`);
    if (ADMIN_CHAT_ID) {
        notifyAdmin(
            `✅ <b>Сервис успешно запущен!</b>\n\n` +
            `🤖 Бот: @${esc(botUsername)}\n` +
            `⭐ Цена: ${STARS_PRICE} Star\n` +
            `🕒 ${new Date().toLocaleString('ru-RU')}`
        );
    }
}).catch(err => console.error('❌ Ошибка Telegram:', err.message));

// ── Команды ───────────────────────────────────────────────────

bot.onText(/^\/start$/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
        `🎁 <b>Привет!</b>\n\nЯ помогаю создавать красивые поздравительные страницы.\n\nЗайди на сайт и нажми <b>"Создать страницу"</b> — я пришлю счёт на ⭐ ${STARS_PRICE} Star.`,
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/start pay_(.+)/, async (msg, match) => {
    const chatId  = msg.chat.id;
    const payload = match[1];
    const user    = userInfo(msg);

    console.log(`⭐ Оплата Stars: chatId=${chatId}`);

    notifyAdmin(
        `🕐 <b>Ожидание оплаты</b>\n\n` +
        `👤 Пользователь: ${user}\n` +
        `🆔 Chat ID: <code>${chatId}</code>\n` +
        `⭐ Сумма: ${STARS_PRICE} Star\n` +
        `📋 Payload: <code>${esc(payload)}</code>\n` +
        `🕒 Время: ${new Date().toLocaleString('ru-RU')}`
    );

    try {
        await bot.sendInvoice(
            chatId,
            '🎁 Создать поздравительную страницу',
            'Красивая страница с фото, анимацией и музыкой.\n' +
            '✅ Уникальная ссылка\n✅ До 5 фотографий\n' +
            '✅ Матричный фон + анимация\n✅ Открытка с переворотом\n✅ Хранение 30 дней',
            payload,
            '',     // provider_token пустой для Stars
            'XTR',
            [{ label: '🎁 Поздравительная страница', amount: STARS_PRICE }]
        );
    } catch (err) {
        console.error('❌ Ошибка инвойса:', err.message);
        await bot.sendMessage(chatId, '⚠️ Не удалось создать счёт. Попробуй позже.');
        notifyAdmin(`❌ <b>Ошибка инвойса</b>\n👤 ${user}\n<code>${esc(err.message)}</code>`);
    }
});

bot.on('pre_checkout_query', async (query) => {
    try { await bot.answerPreCheckoutQuery(query.id, true); } catch (e) {}
});

bot.on('successful_payment', async (msg) => {
    const chatId  = msg.chat.id;
    const payment = msg.successful_payment;
    const payload = payment.invoice_payload;

    console.log(`✅ ОПЛАТА: chatId=${chatId}, ${payment.total_amount} Stars`);

    paidPayloads.set(payload, { chatId, paidAt: Date.now(), stars: payment.total_amount });

    for (const [k, v] of paidPayloads.entries()) {
        if (Date.now() - v.paidAt > 10 * 60 * 1000) paidPayloads.delete(k);
    }

    notifyAdmin(
        `✅ <b>УСПЕШНАЯ ОПЛАТА!</b>\n\n` +
        `👤 ${userInfo(msg)}\n` +
        `🆔 Chat ID: <code>${chatId}</code>\n` +
        `⭐ Оплачено: ${payment.total_amount} Star\n` +
        `🧾 Charge ID: <code>${esc(payment.telegram_payment_charge_id)}</code>\n` +
        `🕒 ${new Date().toLocaleString('ru-RU')}`
    );

    await bot.sendMessage(chatId,
        '🎉 <b>Оплата получена!</b>\n\nСпасибо! Нажми кнопку ниже — страница создастся автоматически.',
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🎁 Вернуться на сайт', url: FRONTEND_URL + '/create.html' }
                ]]
            }
        }
    );
});

// ── REST API ──────────────────────────────────────────────────

// POST /save-page — сохранить страницу в файл
app.post('/save-page', (req, res) => {
    const { id, name, text, photos } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'Missing fields' });
    try {
        const data = { id, name, text: text || '', photos: photos || [], createdAt: Date.now() };
        fs.writeFileSync(path.join(PAGES_DIR, `${id}.json`), JSON.stringify(data));
        console.log(`💾 Страница сохранена: ${id}`);
        res.json({ ok: true, id });
    } catch (err) {
        console.error('❌ Ошибка сохранения:', err.message);
        res.status(500).json({ error: 'Failed to save' });
    }
});

// GET /page/:id — получить страницу по ID
app.get('/page/:id', (req, res) => {
    const file = path.join(PAGES_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });

    let d;
    try { d = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch(e) { return res.status(404).json({ error: 'Not found' }); }

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - d.createdAt > THIRTY_DAYS) {
        fs.unlinkSync(file);
        return res.status(410).json({ error: 'Expired' });
    }

    res.json(d);
});

app.get('/bot-info', (_req, res) => {
    res.json({ username: botUsername, starsPrice: STARS_PRICE });
});

app.get('/check-payment/:payload', (req, res) => {
    const record = paidPayloads.get(req.params.payload);
    if (record) {
        paidPayloads.delete(req.params.payload);
        res.json({ paid: true, stars: record.stars });
    } else {
        res.json({ paid: false });
    }
});

app.get('/health', (_req, res) => {
    res.json({ ok: true, bot: botUsername, uptime: process.uptime() });
});

app.listen(PORT, () => console.log(`\n🚀 Сервер на порту ${PORT}\n`));

bot.on('polling_error', (err) => console.error('⚠️ polling:', err.message));
