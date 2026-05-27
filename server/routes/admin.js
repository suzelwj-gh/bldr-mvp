const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const pool = require('../utils/db');

// Middleware: admin only
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /api/admin/users
router.get('/users', requireAuth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        TRIM(regexp_replace(COALESCE(u.name, ''), '^(PM|Superintendent|superintendent)\s*', '', 'gi')) AS name,
        COUNT(CASE WHEN n.created_at::date = CURRENT_DATE THEN 1 END)::int AS logs_today,
        COUNT(n.id)::int AS logs_total
      FROM users u
      LEFT JOIN notes n ON n.user_id = u.id
      WHERE u.role = 'superintendent'
      GROUP BY u.id, u.name
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin /users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// GET /api/admin/activity
router.get('/activity', requireAuth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TRIM(regexp_replace(COALESCE(u.name, ''), '^(PM|Superintendent|superintendent)\s*', '', 'gi')) AS name, -- v2
        n.id,
        n.type,
        n.created_at,
        n.structured->>'area' AS area,
        n.structured->>'description' AS description,
        n.structured->>'work_completed' AS work_completed
      FROM notes n
      JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin /activity error:', err);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

// GET /api/admin/token-usage
router.get('/token-usage', requireAuth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TRIM(regexp_replace(COALESCE(u.name, ''), '^(PM|Superintendent|superintendent)\s*', '', 'gi')) AS name,
        u.email AS client_id,
        'transcribe' AS action,
        SUM(t.tokens_used)::int AS total_in,
        0::int AS total_out,
        COUNT(*)::int AS calls,
        t.date AS day
      FROM token_usage t
      JOIN users u ON t.user_id = u.id
      WHERE t.date >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY TRIM(regexp_replace(COALESCE(u.name, ''), '^(PM|Superintendent|superintendent)\s*', '', 'gi')), u.email, t.date
      ORDER BY day DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin /token-usage error:', err);
    res.status(500).json({ error: 'Failed to load token usage' });
  }
});

// GET /api/admin/billing
router.get('/billing', requireAuth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.email AS client_id,
        SUM(t.tokens_used)::int AS total_in,
        0::int AS total_out,
        COUNT(*)::int AS total_calls
      FROM token_usage t
      JOIN users u ON t.user_id = u.id
      GROUP BY u.email
    `);
    const rows = result.rows.map(row => ({
      ...row,
      estimated_cost_usd: (
        (row.total_in * 3.0 / 1000000) +
        (row.total_out * 15.0 / 1000000)
      ).toFixed(4)
    }));
    res.json(rows);
  } catch (err) {
    console.error('Admin /billing error:', err);
    res.status(500).json({ error: 'Failed to load billing' });
  }
});

module.exports = router;
