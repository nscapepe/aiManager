const repo = require('../database/lead.repository');
const aiService = require('../services/ai.service');
const leadService = require('../services/lead.service');
const notificationService = require('../services/notification.service');

const HISTORY_LIMIT = 20;

// Очередь на каждого пользователя: сообщения одного клиента обрабатываются строго по порядку,
// чтобы быстрые подряд сообщения не затирали данные заявки друг друга.
const queues = new Map();

function enqueue(key, task) {
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  queues.set(key, next);
  next
    .catch(() => {})
    .then(() => {
      if (queues.get(key) === next) queues.delete(key);
    });
  return next;
}

async function handleText(ctx) {
  try {
    await ctx.sendChatAction('typing');

    const text = ctx.message.text;
    const client = await repo.upsertClient(ctx.from);
    await repo.saveMessage(client.id, 'user', text);

    const history = await repo.getHistory(client.id, HISTORY_LIMIT);
    const lead =
      (await repo.getDraftLead(client.id)) || (await repo.createDraftLead(client.id));

    const ai = await aiService.askAI({ history, leadData: lead });
    const result = await leadService.processExtractedData(lead, ai.data);

    await repo.saveMessage(client.id, 'assistant', ai.reply);
    await ctx.reply(ai.reply);

    if (result.ready) {
      // Заявка уже сохранена как ready. Отправка начальнику — только кодом, не ИИ.
      await notificationService.sendLead(ctx.telegram, result.lead.id);
    }
  } catch (err) {
    console.error('Ошибка обработки сообщения:', err);
    await ctx
      .reply('Произошла ошибка. Попробуйте написать ещё раз через минуту.')
      .catch(() => {});
  }
}

function registerHandlers(bot) {
  bot.on('text', (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();
    if (ctx.message.text.startsWith('/')) return next();
    return enqueue(ctx.from.id, () => handleText(ctx));
  });
}

module.exports = { registerHandlers };
