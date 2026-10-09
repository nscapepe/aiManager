require('dotenv').config(); // должен быть первым: pool.js читает env при импорте

const { Telegraf } = require('telegraf');
const { initDb } = require('./database/pool');
const { registerCommands } = require('./bot/commands');
const { registerHandlers } = require('./bot/handlers');
const notificationService = require('./services/notification.service');

const REQUIRED_ENV = ['BOT_TOKEN', 'OPENAI_API_KEY', 'DATABASE_URL', 'MANAGER_CHAT_ID'];
const RETRY_INTERVAL_MS = 60 * 1000;

async function main() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Не заданы переменные окружения: ${missing.join(', ')}`);
  }

  await initDb();

  const bot = new Telegraf(process.env.BOT_TOKEN);
  registerCommands(bot);
  registerHandlers(bot);

  bot.catch((err, ctx) => {
    console.error(`Ошибка бота (update ${ctx.update.update_id}):`, err);
  });

  // Повторная отправка заявок, которые остались в статусе ready (например, Telegram был недоступен)
  setInterval(() => {
    notificationService.retryPending(bot.telegram).catch((err) => {
      console.error('Ошибка повторной отправки заявок:', err);
    });
  }, RETRY_INTERVAL_MS);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  console.log('Бот запускается...');
  bot.launch().catch((err) => {
    console.error('Не удалось запустить бота:', err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
