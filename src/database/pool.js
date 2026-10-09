const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Ошибка соединения с PostgreSQL:', err);
});

// Создаёт таблицы из schema.sql (скрипт идемпотентный: IF NOT EXISTS)
async function initDb() {
  const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('База данных готова');
}

module.exports = { pool, initDb };
