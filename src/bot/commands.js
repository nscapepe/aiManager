const repo = require('../database/lead.repository');
const notificationService = require('../services/notification.service');
const { isManagerChat, isManagerMode } = require('../config/manager');

const CLIENT_START =
  'Здравствуйте! Я виртуальный менеджер. Подскажу по услугам и помогу оформить заявку.\n\n' +
  'Просто напишите, что вас интересует.';

const CLIENT_HELP =
  'Я могу:\n' +
  '• рассказать об услугах;\n' +
  '• ответить на вопросы;\n' +
  '• принять заявку и передать её менеджеру.\n\n' +
  'Просто опишите свою задачу обычным сообщением.';

const MANAGER_HELP =
  'Вы подключены как менеджер.\n\n' +
  'Новые заявки приходят сюда автоматически. Под каждой есть кнопки «Взял в работу» и «Закрыть».\n\n' +
  'Команды:\n' +
  '/leads — последние заявки\n' +
  '/leads open — только незакрытые\n' +
  '/lead 12 — открыть заявку №12 с кнопками';

function registerCommands(bot) {
  bot.start((ctx) => ctx.reply(isManagerMode(ctx) ? MANAGER_HELP : CLIENT_START));
  bot.help((ctx) => ctx.reply(isManagerMode(ctx) ? MANAGER_HELP : CLIENT_HELP));

  // Команды менеджера. Всем остальным молча ничего не отвечаем.
  bot.command('leads', async (ctx) => {
    if (!isManagerChat(ctx)) return;
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      const onlyOpen = args[0] === 'open';
      const leads = await repo.getLeads({ onlyOpen, limit: 10 });
      await ctx.reply(notificationService.formatLeadList(leads, { onlyOpen }));
    } catch (err) {
      console.error('Ошибка /leads:', err);
      await ctx.reply('Не удалось получить список заявок.').catch(() => {});
    }
  });

  bot.command('lead', async (ctx) => {
    if (!isManagerChat(ctx)) return;
    try {
      const id = Number(ctx.message.text.split(/\s+/)[1]);
      if (!Number.isInteger(id) || id <= 0) {
        return await ctx.reply('Укажите номер заявки, например: /lead 12');
      }
      const lead = await repo.getLeadWithClient(id);
      if (!lead || lead.status === 'draft') return await ctx.reply(`Заявка #${id} не найдена.`);
      await notificationService.sendLeadCard(ctx.telegram, ctx.chat.id, lead);
    } catch (err) {
      console.error('Ошибка /lead:', err);
      await ctx.reply('Не удалось открыть заявку.').catch(() => {});
    }
  });
}

module.exports = { registerCommands };
