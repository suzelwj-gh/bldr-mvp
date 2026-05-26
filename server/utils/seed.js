const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  const password = await bcrypt.hash('bldr2026', 10);

  const users = [
    {
      name: 'Suzel Wyvill-Jones',
      email: 'suzelwj@gmail.com',
      project: 'BLDR Demo',
      pm_email: 'suzelwj@outlook.com',
    },
    {
      name: 'DeMario McIlwain',
      email: 'demario@myskilldora.com',
      project: 'BLDR Demo',
      pm_email: 'demario@myskilldora.com',
    },
    {
      name: 'Conroy Parchment',
      email: 'cparchment@cpjenterprise.com',
      project: 'BLDR Demo',
      pm_email: 'cparchment@cpjenterprise.com',
    },
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (name, email, password, project, pm_email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             project = EXCLUDED.project,
             pm_email = EXCLUDED.pm_email`,
      [u.name, u.email, password, u.project, u.pm_email]
    );
    console.log(`✅ Upserted: ${u.name}`);
  }

  console.log('Seed complete. Password for all accounts: bldr2026');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
