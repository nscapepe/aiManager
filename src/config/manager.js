// Всё, что связано с определением «это менеджер или клиент»

// Менеджерский чат — это чат с id из MANAGER_CHAT_ID (личный чат начальника или группа).
// Проверяем именно чат, а не пользователя: в чужих группах команды менеджера не работают.
function isManagerChat(ctx) {
  const managerId = String(process.env.MANAGER_CHAT_ID || '');
  return Boolean(managerId && ctx.chat && String(ctx.chat.id) === managerId);
}

// Режим теста: менеджер общается с ботом как обычный клиент
function managerAsClient() {
  return process.env.MANAGER_AS_CLIENT === 'true';
}

// Менеджер в «рабочем» режиме (бот не отвечает ему как клиенту)
function isManagerMode(ctx) {
  return isManagerChat(ctx) && !managerAsClient();
}

function displayName(from) {
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ');
  if (fullName && from.username) return `${fullName} (@${from.username})`;
  return fullName || (from.username ? `@${from.username}` : `id ${from.id}`);
}

module.exports = { isManagerChat, managerAsClient, isManagerMode, displayName };
