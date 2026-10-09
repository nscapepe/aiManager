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

-- Статусы заявки: draft -> ready -> sent
CREATE TABLE IF NOT EXISTS leads (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name       TEXT,
  phone      TEXT,
  service    TEXT,
  details    TEXT,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_leads_client_status ON leads (client_id, status);
