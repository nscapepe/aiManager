const repo = require('../database/lead.repository');

const REQUIRED_FIELDS = ['name', 'phone', 'service'];
const EXTRACTABLE_FIELDS = ['name', 'phone', 'service', 'details'];

function cleanString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function getMissingFields(lead) {
  return REQUIRED_FIELDS.filter((field) => {
    if (!lead[field]) return true;
    if (field === 'phone' && !isValidPhone(lead.phone)) return true;
    return false;
  });
}

function isComplete(lead) {
  return getMissingFields(lead).length === 0;
}

// Берём только непустые новые значения, существующие данные не затираем пустыми
function buildUpdates(lead, extracted) {
  const updates = {};
  for (const field of EXTRACTABLE_FIELDS) {
    const value = cleanString(extracted && extracted[field]);
    if (value && value !== lead[field]) updates[field] = value;
  }
  return updates;
}

/**
 * Обновляет заявку данными от ИИ и проверяет обязательные поля.
 * Если заявка готова — переводит её в статус ready.
 * @returns {Promise<{lead: object, ready: boolean}>}
 */
async function processExtractedData(lead, extracted) {
  const updates = buildUpdates(lead, extracted);
  let current = Object.keys(updates).length ? await repo.updateLead(lead.id, updates) : lead;

  if (current.status === 'draft' && isComplete(current)) {
    const ready = await repo.markReady(current.id);
    if (ready) return { lead: ready, ready: true };
  }
  return { lead: current, ready: false };
}

module.exports = { processExtractedData, getMissingFields, isComplete, REQUIRED_FIELDS };
