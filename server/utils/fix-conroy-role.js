const pool = require('./db');

async function fix() {
  const result = await pool.query(
    `UPDATE users SET role = 'admin' WHERE email = 'cparchment@cpjenterprise.com' RETURNING email, role`
  );
  console.log('Updated:', result.rows);
  await pool.end();
}

fix().catch(err => { console.error(err); process.exit(1); });
