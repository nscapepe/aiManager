CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username    TEXT,
  first_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages (client_id, id);

-- Статусы заявки: draft -> ready -> sent -> in_progress -> closed
CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            TEXT,
  phone           TEXT,
  service         TEXT,
  details         TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  handled_by_name TEXT,
  handled_at      TIMESTAMPTZ,
  closed_by_name  TEXT,
  closed_at       TIMESTAMPTZ
);

-- Миграция для уже существующей базы (безопасно выполнять повторно)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS handled_by_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_by_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('draft', 'ready', 'sent', 'in_progress', 'closed'));

CREATE INDEX IF NOT EXISTS idx_leads_client_status ON leads (client_id, status);
