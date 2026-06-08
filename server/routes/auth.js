const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../utils/db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  if (!email || !password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, role, name, project FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, project: user.project },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/reset-demo-passwords', async (req, res) => {
  try {
    const hash = await bcrypt.hash('bldr2026', 10);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id IN (3, 4, 5)`,
      [hash]
    );
    res.json({ message: 'Passwords reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
