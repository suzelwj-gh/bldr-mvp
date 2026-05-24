const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('issue', 'progress', 'rfi')),
      structured JSONB NOT NULL,
      raw_transcript TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes (user_id, created_at DESC);
  `);
  console.log('Notes table ready.');
  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
