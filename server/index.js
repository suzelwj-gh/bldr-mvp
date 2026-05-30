const express = require('express');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const authRouter = require('./routes/auth');
const reportRouter = require('./routes/report');
const documentsRouter = require('./routes/documents');
const { requireAuth } = require('./middleware/auth');
const authenticateToken = requireAuth;
const transcribeRouter = require('./routes/transcribe');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRouter);
app.use('/api/report', reportRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/transcribe', transcribeRouter(upload));
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ARI is running', timestamp: new Date() });
});
app.post('/api/structure-transcript', requireAuth, async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || transcript.trim().length === 0) {
    return res.status(400).json({ error: 'No transcript provided.' });
  }
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const systemPrompt = `You are a construction field assistant. Your job is to take a raw voice transcript from a construction superintendent and extract structured data for a daily field log.

Always respond with ONLY valid JSON — no preamble, no markdown, no explanation, no code fences. If the transcript is empty, garbled, or clearly not construction-related, return:
{"error": "Unable to extract construction log data from this transcript"}

FIELD EXTRACTION RULES:

date: Extract if mentioned (e.g. "today is June 3rd", "Monday the 5th"). Format as YYYY-MM-DD. If not mentioned, use null.

project: Extract the project name or number if mentioned. Otherwise null.

weather: Extract weather conditions from ANY natural language mention — "it's hot", "rained this morning", "clear skies", "about 85 degrees", "windy", "overcast". Capture the full description as a single string. If not mentioned, use null.

crew_count: Extract headcount if mentioned (e.g. "14 guys on site", "crew of 8"). Format as a string like "14 workers on site". If not mentioned, use null.

personnel_notes: Array of strings. One entry per notable person mentioned (arrivals, departures, injuries, performance notes).

work_completed: Array of objects. Each object has:
  - area: the trade, zone, or location (e.g. "third floor framing", "electrical rough-in")
  - description: what was done

issues: Array of objects. Each object has:
  - priority: "HIGH" | "MEDIUM" | "LOW"
  - description: clear description of the issue

  Priority rules:
  - HIGH: safety concerns, work stoppages, structural problems, anything blocking the critical path
  - MEDIUM: delays, material shortages, coordination issues, rework needed
  - LOW: minor observations, aesthetic concerns, non-urgent follow-ups

site_conditions: Any general site observations not captured elsewhere (access, cleanliness, security, inspections). String or null.

next_steps: Array of strings. One per action item mentioned.

raw_notes: String. Any details from the transcript that don't fit the above fields.

GUARDRAILS:
- Do NOT invent data. If something isn't in the transcript, use null or an empty array.
- Do NOT add assumptions, context, or elaborations beyond what was said.
- Do NOT interpret ambiguous statements — capture them verbatim in raw_notes instead.
- If the superintendent mentions a number, name, or date, capture it exactly as stated.
- This is a legal field document. Accuracy is more important than completeness.

Respond with this exact structure:
{
  "date": "YYYY-MM-DD or null",
  "project": "string or null",
  "weather": "string or null",
  "crew_count": "string or null",
  "personnel_notes": ["string"],
  "work_completed": [{ "area": "string", "description": "string" }],
  "issues": [{ "priority": "HIGH|MEDIUM|LOW", "description": "string" }],
  "site_conditions": "string or null",
  "next_steps": ["string"],
  "raw_notes": "string or null"
}`;

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

const ACTION_SYSTEM_PROMPT = `You are ARI, an AI assistant for construction superintendents. Analyze the transcript and classify it into exactly one log type.

ROUTING RULES:
- "issue": transcript describes a problem, hazard, blocker, safety concern, conflict, defect, or anything that needs resolution
- "progress": transcript describes work completed, crew activity, progress made, materials installed, or site status
- "rfi": transcript describes an unanswered question, unclear specification, missing information, or a request for clarification from the design or ownership team

GUARDRAILS:
- Choose ONE type only — the dominant intent of the transcript
- If the transcript contains both a problem and completed work, classify by whichever is more urgent
- Do NOT invent fields. Use null for anything not mentioned.
- Do NOT add context, assumptions, or professional opinions beyond what was said.
- Respond ONLY with valid JSON. No markdown. No preamble.

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

app.post('/api/notes', authenticateToken, async (req, res) => {
  const { type, structured, rawTranscript } = req.body;
  if (!type || !structured) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const result = await pool.query(
      'INSERT INTO notes (user_id, type, structured, raw_transcript) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
      [req.user.id, type, JSON.stringify(structured), rawTranscript || null]
    );
    res.json({ id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (err) {
    console.error('Save note error:', err);
    res.status(500).json({ error: 'Failed to save note.' });
  }
});

app.get('/api/notes/today', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, structured, raw_transcript, created_at
       FROM notes
       WHERE user_id = $1 AND created_at::date = NOW()::date
       ORDER BY created_at ASC`,
      [req.user.id]
    );
    const notes = result.rows.map(r => ({
      id: r.id,
      type: r.type,
      structured: r.structured,
      rawTranscript: r.raw_transcript,
      createdAt: r.created_at
    }));
    res.json({ notes });
  } catch (err) {
    console.error('Fetch notes error:', err);
    res.status(500).json({ error: 'Failed to fetch notes.' });
  }
});

app.listen(PORT, () => {
  console.log(`ARI server running on port ${PORT}`);
});

module.exports = app;
