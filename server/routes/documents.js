const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateDoc } = require('../utils/generateDoc');
const pool = require('../utils/db');

const router = express.Router();

function safePart(value, fallback) {
  return String(value || fallback).trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function sendDocx(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

router.post('/daily-report', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const notesResult = await pool.query(
      `SELECT * FROM notes WHERE user_id = $1 AND DATE(created_at) = $2 ORDER BY created_at ASC`,
      [user.id, todayStr]
    );
    const notes = notesResult.rows;

    const issues = notes.filter(n => n.type === 'issue');
    const progress = notes.filter(n => n.type === 'progress');
    const rfis = notes.filter(n => n.type === 'rfi');

    const issuesSummary = issues.length
      ? issues.map((n, i) => {
        const s = (n.structured && n.structured[0]) ? n.structured[0] : (n.structured || {});
        return `${i+1}. [${formatTime(n.created_at)}] ${s.description || s.issue || 'Issue noted'}`;
      }).join('\n')
      : 'No issues reported.';

    const workSummary = progress.length
      ? progress.map((n, i) => {
        const s = (n.structured && n.structured[0]) ? n.structured[0] : (n.structured || {});
        return `${i+1}. [${formatTime(n.created_at)}] ${s.work_completed || s.summary || 'Progress noted'}`;
      }).join('\n')
      : 'No progress notes recorded.';

    const rfiSummary = rfis.length
      ? rfis.map((n, i) => {
        const s = (n.structured && n.structured[0]) ? n.structured[0] : (n.structured || {});
        return `${i+1}. [${formatTime(n.created_at)}] ${s.subject || s.question || 'RFI noted'}`;
      }).join('\n')
      : 'No RFIs referenced today.';

    const weatherExtracted = notes
      .filter(n => n.structured)
      .map(n => {
        const s = (n.structured && n.structured[0]) ? n.structured[0] : (n.structured || {});
        return s.notes || null;
      })
      .filter(n => n && (n.toLowerCase().includes('weather') || n.toLowerCase().includes('temp') || n.toLowerCase().includes('degree') || n.toLowerCase().includes('overcast') || n.toLowerCase().includes('sunny') || n.toLowerCase().includes('rain')))
      [0] || null;
    const tempMatch = weatherExtracted ? weatherExtracted.match(/(\d+)\s*degree/i) : null;
    const tempF = tempMatch ? tempMatch[1] : '';

    const data = {
      project_name: user.project_name || 'ARI Demo Project',
      project_number: user.project_number || '2026-001',
      date: formatDate(today),
      day_of_week: DAYS[today.getDay()],
      report_number: todayStr.replace(/-/g, ''),
      superintendent_name: user.name || user.email,
      pm_email: user.pm_email || '',
      weather_am_temp: tempF,
      weather_pm_temp: tempF,
      weather_condition: weatherExtracted || 'Not recorded',
      weather_delay: 'No',
      weather_delay_hours: '0',
      site_conditions: 'Normal',
      general_notes: notes.length ? `${notes.length} field note(s) recorded today.` : 'No notes recorded.',
      work_accomplished: workSummary,
      manpower_summary: 'See superintendent log.',
      second_tier_summary: '',
      temp_laborers: '',
      visitors_summary: '',
      equipment_summary: '',
      deliveries_summary: '',
      safety_issues: issuesSummary,
      rfis_summary: rfiSummary,
      tm_work: '',
      progress_photos: '',
      generated_at: new Date().toLocaleString('en-US'),
    };

    const buffer = generateDoc('BLDR_Daily_Construction_Report.docx', data);
    sendDocx(res, buffer, `ari-report-${safePart(todayStr, 'today')}.docx`);
  } catch (err) {
    console.error('Daily report DOCX error:', err);
    res.status(500).json({ error: 'Failed to generate daily report.' });
  }
});

module.exports = router;
