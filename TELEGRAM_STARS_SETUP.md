# Настройка оплаты Telegram Stars

## Что уже сделано во фронтенде
- Кнопка "Создать страницу" открывает окно оплаты ⭐ 50 Stars
- После оплаты страница создаётся автоматически
- Срок хранения страниц — **30 дней** (реализовано)

## Что нужно сделать для запуска Stars

### Шаг 1: Создать Telegram бота
1. Открой @BotFather в Telegram
2. Напиши `/newbot`
3. Придумай имя и username (например `MyBirthdayBot`)
4. Сохрани **токен бота** (вида `123456:ABCdef...`)

### Шаг 2: Включить Telegram Stars у бота
Stars работают автоматически — дополнительно ничего включать не нужно.

### Шаг 3: Создать маленький Node.js сервер

```bash
mkdir birthday-bot
cd birthday-bot
npm init -y
npm install node-telegram-bot-api express cors
```

Создай файл `server.js`:

```javascript
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

const TOKEN  = 'СЮДА_ВСТАВЬ_ТОКЕН_БОТА';
const PORT   = 3000;
const STARS_PRICE = 50; // цена в Stars

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(cors());
app.use(express.json());

// Хранилище оплат (в продакшне используй базу данных)
const paidPayloads = new Set();

// Команда /start pay_PAYLOAD
bot.onText(/\/start pay_(.+)/, async (msg, match) => {
    const chatId  = msg.chat.id;
    const payload = match[1];

    await bot.sendInvoice(chatId,
        '🎁 Создать поздравление',
        'Уникальная страница с фото, анимацией и музыкой на 30 дней',
        payload,        // payload для отслеживания
        'XTR',          // XTR = Telegram Stars
        [{ label: 'Поздравительная страница', amount: STARS_PRICE }]
    );
});

// Подтверждение оплаты
bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true);
});

// Успешная оплата
bot.on('successful_payment', async (msg) => {
    const payload = msg.successful_payment.invoice_payload;
    const chatId  = msg.chat.id;

    paidPayloads.add(payload);

    await bot.sendMessage(chatId,
        '✅ Оплата получена! Вернитесь на сайт — страница создаётся автоматически.'
    );
});

// API для фронтенда: проверить оплату
app.get('/check-payment/:payload', (req, res) => {
    const paid = paidPayloads.has(req.params.payload);
    if (paid) paidPayloads.delete(req.params.payload); // одноразовый
    res.json({ paid });
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
```

Запусти:
```bash
node server.js
```

### Шаг 4: Подключи сервер к create.html

Открой `create.html` и измени 3 строки:

```javascript
const TG_BOT_USERNAME = 'MyBirthdayBot'; // ← username твоего бота (без @)
const STARS_PRICE     = 50;              // ← цена в Stars
const PAYMENT_ENABLED = true;            // ← включить оплату
```

И в функции проверки оплаты замени `localStorage.getItem` на запрос к серверу:

```javascript
// В check = setInterval(...) замени строку:
const paid = localStorage.getItem(`paid_${payload}`);
// На:
const r = await fetch(`http://localhost:3000/check-payment/${payload}`);
const { paid } = await r.json();
```

### Шаг 5: Хостинг сервера (бесплатно)

Для работы в интернете залей сервер на:
- **Railway.app** — бесплатно, деплой через GitHub
- **Render.com** — бесплатно
- **Fly.io** — бесплатно

После деплоя замени `http://localhost:3000` на URL сервера.

---

## Итоговый flow

```
Пользователь → заполняет форму → жмёт "Создать"
     ↓
Окно оплаты ⭐ 50 Stars → открывает Telegram бот
     ↓
Бот отправляет инвойс → пользователь платит Stars
     ↓
Бот подтверждает оплату → сайт проверяет каждые 3 сек
     ↓
Страница создаётся → выдаётся уникальная ссылка 🎉
```
