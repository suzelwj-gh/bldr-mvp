require('dotenv').config();
const pool = require('./db');

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS project VARCHAR DEFAULT 'ARI Demo',
        ADD COLUMN IF NOT EXISTS pm_email VARCHAR DEFAULT '';
    `);
    console.log('✅ Users table updated with project and pm_email columns');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();