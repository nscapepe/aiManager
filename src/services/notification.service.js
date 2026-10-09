const repo = require('../database/lead.repository');

function formatLead(lead) {
  const contact = lead.username ? `@${lead.username}` : `id ${lead.telegram_id}`;
  return [
    `📩 Новая заявка #${lead.id}`,
    '',
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Услуга: ${lead.service}`,
    `Детали: ${lead.details || '—'}`,
    '',
    `Telegram: ${contact}`,
  ].join('\n');
}

/**
 * Отправляет заявку начальнику. Статус sent ставится ТОЛЬКО после успешного ответа Telegram API.
 * @returns {Promise<boolean>} true — отправлено
 */
async function sendLead(telegram, leadId) {
  const lead = await repo.getLeadWithClient(leadId);
  if (!lead || lead.status !== 'ready') return false;

  try {
    await telegram.sendMessage(process.env.MANAGER_CHAT_ID, formatLead(lead));
  } catch (err) {
    console.error(`Не удалось отправить заявку #${leadId}:`, err.message);
    return false; // останется ready — retryPending попробует позже
  }

  await repo.markSent(leadId);
  return true;
}

async function retryPending(telegram) {
  const ids = await repo.getStaleReadyLeadIds();
  for (const id of ids) {
    await sendLead(telegram, id);
  }
}

module.exports = { sendLead, retryPending, formatLead };
