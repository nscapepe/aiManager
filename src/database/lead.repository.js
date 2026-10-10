const { pool } = require('./pool');

const LEAD_FIELDS = ['name', 'phone', 'service', 'details'];
const OPEN_STATUSES = ['ready', 'sent', 'in_progress'];
const ALL_STATUSES = [...OPEN_STATUSES, 'closed'];

async function upsertClient(from) {
  const { rows } = await pool.query(
    `INSERT INTO clients (telegram_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id)
     DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
     RETURNING *`,
    [from.id, from.username || null, from.first_name || null]
  );
  return rows[0];
}

async function saveMessage(clientId, role, content) {
  await pool.query(
    'INSERT INTO messages (client_id, role, content) VALUES ($1, $2, $3)',
    [clientId, role, content]
  );
}

// Последние N сообщений в хронологическом порядке
async function getHistory(clientId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT role, content FROM (
       SELECT id, role, content FROM messages
       WHERE client_id = $1
       ORDER BY id DESC
       LIMIT $2
     ) t
     ORDER BY id ASC`,
    [clientId, limit]
  );
  return rows;
}

async function getDraftLead(clientId) {
  const { rows } = await pool.query(
    `SELECT * FROM leads WHERE client_id = $1 AND status = 'draft' ORDER BY id DESC LIMIT 1`,
    [clientId]
  );
  return rows[0] || null;
}

async function createDraftLead(clientId) {
  const { rows } = await pool.query(
    'INSERT INTO leads (client_id) VALUES ($1) RETURNING *',
    [clientId]
  );
  return rows[0];
}

async function updateLead(leadId, fields) {
  const keys = LEAD_FIELDS.filter((key) => fields[key] !== undefined);
  if (!keys.length) {
    const { rows } = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    return rows[0];
  }
  const sets = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const values = keys.map((key) => fields[key]);
  const { rows } = await pool.query(
    `UPDATE leads SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
    [leadId, ...values]
  );
  return rows[0];
}

// draft -> ready (только из draft, чтобы не пометить дважды)
async function markReady(leadId) {
  const { rows } = await pool.query(
    `UPDATE leads SET status = 'ready', updated_at = now()
     WHERE id = $1 AND status = 'draft' RETURNING *`,
    [leadId]
  );
  return rows[0] || null;
}

// ready -> sent (вызывается только после успешного ответа Telegram API)
async function markSent(leadId) {
  const { rows } = await pool.query(
    `UPDATE leads SET status = 'sent', sent_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'ready' RETURNING *`,
    [leadId]
  );
  return rows[0] || null;
}

// sent -> in_progress. Атомарно: если заявку уже взял другой менеджер, вернётся null
async function takeLead(leadId, managerName) {
  const { rows } = await pool.query(
    `UPDATE leads
     SET status = 'in_progress', handled_by_name = $2, handled_at = now(), updated_at = now()
     WHERE id = $1 AND status IN ('ready', 'sent') RETURNING id`,
    [leadId, managerName]
  );
  return rows[0] || null;
}

// sent / in_progress -> closed
async function closeLead(leadId, managerName) {
  const { rows } = await pool.query(
    `UPDATE leads
     SET status = 'closed', closed_by_name = $2, closed_at = now(), updated_at = now()
     WHERE id = $1 AND status IN ('ready', 'sent', 'in_progress') RETURNING id`,
    [leadId, managerName]
  );
  return rows[0] || null;
}

async function getLeadWithClient(leadId) {
  const { rows } = await pool.query(
    `SELECT l.*, c.telegram_id, c.username, c.first_name
     FROM leads l JOIN clients c ON c.id = l.client_id
     WHERE l.id = $1`,
    [leadId]
  );
  return rows[0] || null;
}

// Список заявок для менеджера (без черновиков)
async function getLeads({ onlyOpen = false, limit = 10 } = {}) {
  const { rows } = await pool.query(
    `SELECT l.*, c.telegram_id, c.username, c.first_name
     FROM leads l JOIN clients c ON c.id = l.client_id
     WHERE l.status = ANY($1)
     ORDER BY l.id DESC
     LIMIT $2`,
    [onlyOpen ? OPEN_STATUSES : ALL_STATUSES, limit]
  );
  return rows;
}

// Заявки, которые «зависли» в ready дольше минуты
async function getStaleReadyLeadIds() {
  const { rows } = await pool.query(
    `SELECT id FROM leads
     WHERE status = 'ready' AND updated_at < now() - interval '1 minute'
     ORDER BY id ASC`
  );
  return rows.map((row) => row.id);
}

module.exports = {
  upsertClient,
  saveMessage,
  getHistory,
  getDraftLead,
  createDraftLead,
  updateLead,
  markReady,
  markSent,
  takeLead,
  closeLead,
  getLeadWithClient,
  getLeads,
  getStaleReadyLeadIds,
};
