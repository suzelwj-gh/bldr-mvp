require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const saltRounds = 10;

const users = [
  {
    name: 'Superintendent',
    email: 'super@bldr.app',
    password: 'bldr1234',
    role: 'superintendent',
  },
  {
    name: 'Admin',
    email: 'admin@bldr.app',
    password: 'bldr1234',
    role: 'admin',
  },
];

async function seed() {
  try {
    for (const user of users) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
        user.email,
      ]);

      if (existing.rows.length > 0) {
        console.log(`User ${user.email} already exists, skipping.`);
        continue;
      }

      const passwordHash = await bcrypt.hash(user.password, saltRounds);
      await pool.query(
        'INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, $3, $4)',
        [user.email, passwordHash, user.role, user.name]
      );
      console.log(`Created user: ${user.email}`);
    }
    console.log('Seed complete.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
