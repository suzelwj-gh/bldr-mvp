require('dotenv').config();
const pool = require('./db');

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS daily_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_name VARCHAR,
    log_date DATE,
    transcript_raw TEXT,
    structured_report JSONB,
    audio_file_url TEXT,
    token_usage INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS token_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE,
    tokens_used INTEGER,
    cost_usd NUMERIC(10, 4),
    created_at TIMESTAMP DEFAULT NOW()
  )`,
];

async function migrate() {
  try {
    for (const sql of migrations) {
      await pool.query(sql);
    }
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
