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
      model: 'claude-haiku-4-5-20251001',
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

const ACTION_SYSTEM_PROMPT = `You are BLDR, an AI assistant for construction superintendents. Analyze the transcript and determine which ONE action type it describes, then structure the content accordingly.

ROUTING RULES:
- If the transcript describes a problem, hazard, blocker, conflict, delay, or anything going wrong → type: "issue"
- If the transcript describes work completed, progress made, crew activity, tasks done → type: "progress"  
- If the transcript describes an unanswered question, unclear spec, missing information, or something that needs a formal written request → type: "rfi"

Respond ONLY with valid JSON. No explanation. No markdown. No code fences. Just raw JSON.

For type "issue":
{
  "type": "issue",
  "date": "YYYY-MM-DD",
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "area": "location or trade area",
  "description": "clear description of the issue",
  "impact": "what work is affected or at risk",
  "recommended_action": "what should happen next",
  "logged_by": "Superintendent"
}

For type "progress":
{
  "type": "progress",
  "date": "YYYY-MM-DD",
  "area": "location or trade area",
  "work_completed": "description of what was done",
  "crew": "crew or trade mentioned, or 'Not specified'",
  "notes": "any additional observations",
  "logged_by": "Superintendent"
}

For type "rfi":
{
  "type": "rfi",
  "date": "YYYY-MM-DD",
  "subject": "brief subject line for the RFI",
  "question": "the specific question or clarification needed",
  "area_affected": "location or scope affected",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "requested_by": "Superintendent",
  "notes": "any context or background"
}`;

app.post('/api/structure-action', requireAuth, async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || transcript.trim().length === 0) {
    return res.status(400).json({ error: 'No transcript provided.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analyze and structure this field note transcript:\n\n${transcript}`,
        },
      ],
      system: ACTION_SYSTEM_PROMPT,
    });

    const rawText = message.content[0].text.trim();
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    try {
      const structured = JSON.parse(cleaned);
      res.json(structured);
    } catch {
      res.status(500).json({ error: 'Could not structure transcript' });
    }
  } catch (err) {
    console.error('Claude API error (structure-action):', err);
    res.status(500).json({ error: 'Failed to structure transcript. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`BLDR server running on port ${PORT}`);
});

module.exports = app;