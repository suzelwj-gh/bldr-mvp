require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: connectionString && /rlwy\.net|railway\.app/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

const SOURCE_EMAIL = 'cparchment@cpjenterprise.com';
const NEW_EMAIL = 'cmo11906@gmail.com';
const NEW_NAME = 'Carl Moore';
const NEW_ROLE = 'superintendent';
const NEW_PROJECT = 'ARI Demo';

async function run() {
  const source = await pool.query(
    `SELECT password_hash, pm_email FROM users WHERE email = $1`,
    [SOURCE_EMAIL]
  );

  if (source.rows.length === 0) {
    throw new Error(`Source account not found: ${SOURCE_EMAIL}`);
  }

  const { password_hash, pm_email } = source.rows[0];

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, project, pm_email)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       project = EXCLUDED.project,
       pm_email = EXCLUDED.pm_email
     RETURNING id, name, email, role, project`,
    [NEW_NAME, NEW_EMAIL, password_hash, NEW_ROLE, NEW_PROJECT, pm_email || SOURCE_EMAIL]
  );

  console.log('Superintendent account ready:', result.rows[0]);
  await pool.end();
}

run().catch((err) => {
  console.error('add-carl-moore-superintendent failed:', err);
  process.exit(1);
});
