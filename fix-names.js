require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixNames() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const result = await pool.query(`
    UPDATE users
    SET name = TRIM(regexp_replace(name, '^(PM|Superintendent|superintendent)\s*', '', 'gi'))
  `);

  console.log(`Updated ${result.rowCount} user name(s).`);
  await pool.end();
}

fixNames().catch((err) => {
  console.error('fix-names failed:', err);
  process.exit(1);
});
