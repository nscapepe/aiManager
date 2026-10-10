const repo = require('../database/lead.repository');

const STATUS_LABELS = {
  draft: '📝 Черновик',
  ready: '⏳ Не отправлена',
  sent: '🆕 Новая',
  in_progress: '🟡 В работе',
  closed: '✅ Закрыта',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function contactText(lead) {
  return lead.username ? `@${lead.username}` : `id ${lead.telegram_id}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: process.env.TIMEZONE || 'UTC',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLead(lead) {
  const lines = [
    `📩 Заявка #${lead.id} — ${statusLabel(lead.status)}`,
    '',
    `Имя: ${lead.name}`,
    ...(lead.phone ? [`Телефон: ${lead.phone}`] : []),
    `Услуга: ${lead.service}`,
    `Детали: ${lead.details || '—'}`,
    '',
    `Telegram: ${contactText(lead)}`,
  ];
  if (lead.handled_by_name) lines.push(`В работу взял: ${lead.handled_by_name}`);
  if (lead.closed_by_name) lines.push(`Закрыл: ${lead.closed_by_name}`);
  return lines.join('\n');
}

function clientUrl(lead) {
  return lead.username ? `https://t.me/${lead.username}` : `tg://user?id=${lead.telegram_id}`;
}

// Кнопки под заявкой зависят от её статуса
function buildKeyboard(lead, { withProfileLink = true } = {}) {
  const rows = [];
  const actions = [];
  if (['ready', 'sent'].includes(lead.status)) {
    actions.push({ text: '✅ Взял в работу', callback_data: `lead:take:${lead.id}` });
  }
  if (['ready', 'sent', 'in_progress'].includes(lead.status)) {
    actions.push({ text: '🔒 Закрыть', callback_data: `lead:close:${lead.id}` });
  }
  if (actions.length) rows.push(actions);
  if (withProfileLink) rows.push([{ text: '👤 Написать клиенту', url: clientUrl(lead) }]);
  return { reply_markup: { inline_keyboard: rows } };
}

// Если у клиента закрытые настройки приватности, Telegram отвергает кнопку tg://user?id=...
function isButtonUserError(err) {
  return /BUTTON_USER/i.test(String((err && (err.description || err.message)) || ''));
}

function isNotModifiedError(err) {
  return /message is not modified/i.test(String((err && (err.description || err.message)) || ''));
}

async function sendLeadCard(telegram, chatId, lead) {
  try {
    return await telegram.sendMessage(chatId, formatLead(lead), buildKeyboard(lead));
  } catch (err) {
    if (!isButtonUserError(err)) throw err;
    return telegram.sendMessage(
      chatId,
      formatLead(lead),
      buildKeyboard(lead, { withProfileLink: false })
    );
  }
}

// Обновляет сообщение с заявкой после нажатия кнопки
async function editLeadCard(ctx, lead) {
  try {
    try {
      await ctx.editMessageText(formatLead(lead), buildKeyboard(lead));
    } catch (err) {
      if (!isButtonUserError(err)) throw err;
      await ctx.editMessageText(formatLead(lead), buildKeyboard(lead, { withProfileLink: false }));
    }
  } catch (err) {
    if (!isNotModifiedError(err)) throw err;
  }
}

function formatLeadList(leads, { onlyOpen = false, draftCount = 0 } = {}) {
  const draftNote = draftCount
    ? `\n\nНе завершены (не хватает имени или услуги): ${draftCount}`
    : '';

  if (!leads.length) {
    return (onlyOpen ? 'Незакрытых заявок нет.' : 'Заявок пока нет.') + draftNote;
  }

  const items = leads.map(
    (lead) =>
      `#${lead.id} ${statusLabel(lead.status)}\n` +
      `${[lead.name, lead.phone, lead.service].filter(Boolean).join(' · ') || '—'}\n` +
      `${contactText(lead)} · ${formatDate(lead.created_at)}`
  );
  const title = onlyOpen ? 'Незакрытые заявки:' : 'Последние заявки:';
  return `${title}\n\n${items.join('\n\n')}\n\nОткрыть заявку с кнопками: /lead <номер>${draftNote}`;
}

/**
 * Отправляет заявку начальнику. Статус sent ставится ТОЛЬКО после успешного ответа Telegram API.
 * @returns {Promise<boolean>} true — отправлено
 */
async function sendLead(telegram, leadId) {
  const lead = await repo.getLeadWithClient(leadId);
  if (!lead || lead.status !== 'ready') return false;

  try {
    // Карточку рисуем уже как «новую»: после успешной отправки заявка станет sent
    await sendLeadCard(telegram, process.env.MANAGER_CHAT_ID, { ...lead, status: 'sent' });
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

module.exports = {
  sendLead,
  sendLeadCard,
  editLeadCard,
  retryPending,
  formatLead,
  formatLeadList,
  buildKeyboard,
  statusLabel,
};
