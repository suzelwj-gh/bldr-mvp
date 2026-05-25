const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateDoc } = require('../utils/generateDoc');

const router = express.Router();

function safePart(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function sendDocx(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

router.post('/daily-report', requireAuth, (req, res) => {
  try {
    const body = req.body || {};
    const buffer = generateDoc('BLDR_Daily_Construction_Report.docx', body);
    const date = safePart(body.date, 'today');
    sendDocx(res, buffer, `daily-report-${date}.docx`);
  } catch (err) {
    console.error('Daily report DOCX error:', err);
    res.status(500).json({ error: 'Failed to generate daily report.' });
  }
});

router.post('/rfi', requireAuth, (req, res) => {
  try {
    const body = req.body || {};
    const buffer = generateDoc('BLDR_RFI_Template.docx', body);
    const rfiNumber = safePart(body.rfi_number || body.date_received || body.date_required, 'new');
    sendDocx(res, buffer, `rfi-${rfiNumber}.docx`);
  } catch (err) {
    console.error('RFI DOCX error:', err);
    res.status(500).json({ error: 'Failed to generate RFI.' });
  }
});

router.post('/issue-tracker', requireAuth, (req, res) => {
  try {
    const body = req.body || {};
    const buffer = generateDoc('BLDR_Issue_Tracker.docx', body);
    const date = safePart(body.date || body.created_date || body.issue_date, 'today');
    sendDocx(res, buffer, `issue-tracker-${date}.docx`);
  } catch (err) {
    console.error('Issue tracker DOCX error:', err);
    res.status(500).json({ error: 'Failed to generate issue tracker.' });
  }
});

module.exports = router;
