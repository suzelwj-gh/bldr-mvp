const express = require('express');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const authRouter = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');
const transcribeRouter = require('./routes/transcribe');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRouter);
app.use('/api/transcribe', transcribeRouter(upload));

app.get('/api/health', (req, res) => {
  res.json({ status: 'BLDR is running', timestamp: new Date() });
});
app.post('/api/structure-transcript', requireAuth, async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || transcript.trim().length === 0) {
    return res.status(400).json({ error: 'No transcript provided.' });
  }
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const systemPrompt = `You are a construction field assistant. Your job is to take a raw voice transcript from a construction superintendent and structure it into a professional daily log.

Always respond with ONLY valid JSON — no preamble, no markdown, no explanation. Use exactly this structure:

{
  "date": "string",
  "project": "string or null if not mentioned",
  "weather": "string or null",
  "crew_count": "string or null (e.g. '14 workers on site')",
  "personnel_notes": ["array of strings, one per notable personnel note"],
  "work_completed": [
    { "area": "string (trade or location)", "description": "string" }
  ],
  "issues": [
    { "priority": "HIGH | MEDIUM | LOW", "description": "string" }
  ],
  "site_conditions": "string or null",
  "next_steps": ["array of strings, one per action item"],
  "raw_notes": "string — any details from the transcript that don't fit above"
}

Priority rules for issues:
- HIGH: safety concerns, work stoppages, structural problems, anything blocking progress
- MEDIUM: delays, material shortages, coordination issues, rework needed
- LOW: minor observations, aesthetic concerns, non-urgent follow-ups

If the transcript doesn't mention something, use null for strings or [] for arrays. Never invent information not in the transcript. Today's date is ${today}.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Structure this construction site transcript into a daily log:\n\n${transcript}`
        }
      ],
      system: systemPrompt
    });
    const rawText = message.content[0].text.trim();
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let structured;
    try {
      structured = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(500).json({ error: 'AI returned unexpected format. Please try again.' });
    }
    res.json({ success: true, log: structured });
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: 'Failed to structure transcript. Please try again.' });
  }
});
app.listen(PORT, () => {
  console.log(`BLDR server running on port ${PORT}`);
});

module.exports = app;