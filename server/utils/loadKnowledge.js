const path = require('path');
const mammoth = require('mammoth');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const GUIDE_PATH = path.join(KNOWLEDGE_DIR, 'ARI_Superintendent_Knowledge_Guide.docx');
const GLOSSARY_PATH = path.join(KNOWLEDGE_DIR, 'CPJ_Ari_Construction_Terms_Glossary.docx');

const GLOSSARY_SKIP = new Set([
  'Abbr / Term',
  'Full Name',
  'Definition & Field Context',
  'PURPOSE',
]);

let SUPERINTENDENT_GUIDE = '';
let CONSTRUCTION_GLOSSARY = '';
let loadPromise;

function clip(text, max = 320) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function nextNonEmpty(lines, start) {
  let i = start;
  while (i < lines.length && !lines[i]) i += 1;
  return i;
}

function summarizeGlossary(glossaryText) {
  const lines = glossaryText.split(/\r?\n/).map((line) => line.trim());
  const entries = [];
  const seen = new Set();

  for (let i = 0; i < lines.length - 2; i += 1) {
    const term = lines[i];
    if (!term || GLOSSARY_SKIP.has(term)) continue;
    if (/^Total Terms:/i.test(term)) continue;
    if (/^Prepared by|^AI Training|^Commercial Construction|^Industry Terms/i.test(term)) continue;
    if (/^  [A-Z].*&/.test(term)) continue;

    const fullIdx = nextNonEmpty(lines, i + 1);
    const full = lines[fullIdx];
    if (!full || GLOSSARY_SKIP.has(full)) continue;

    const defIdx = nextNonEmpty(lines, fullIdx + 1);
    const definition = lines[defIdx];
    if (!definition || definition.length < 20 || !/^[A-Z(]/.test(definition)) continue;

    const key = `${term}|${full}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const brief = definition.split(/(?<=[.!?])\s+/)[0].slice(0, 120);
    entries.push(`${term} (${full}): ${brief}`);
    i = defIdx;
  }

  return entries.join('\n');
}

function summarizeSuperintendentGuide(guideText) {
  const verbalMatch = guideText.match(/if it wasn't written, it didn't happen[^.]*\./i);
  const dailyReportIdx = guideText.indexOf('The daily report is the single most important');

  return [
    'ROLE: The super is the GC on-site leader — constantly in the field. ARI must reduce admin burden and speak field language.',
    'DAILY RHYTHM: Pre-start site walk (5:30–6:30) → mobilization/toolbox talk/manpower (6:30–7:00) → morning production (7–12) → midday admin → afternoon push/deliveries (1–3:30) → end-of-day walk (3:30–4:30: verify work, secure site) → daily log window (4:30–6:00).',
    'END-OF-DAY QUESTIONS: Capture manpower by trade, weather AM/PM, work completed by area, deliveries, visitors, safety incidents, open RFIs, incomplete work, coordination conflicts, and next-day plan.',
    `VERBAL DIRECTIONS: ${verbalMatch ? clip(verbalMatch[0], 360) : "If it wasn't written, it didn't happen. Log verbal directions from owner, architect, or PM."}`,
    'PCO / CHANGE ORDER TRIGGERS: Flag scope changes, extra work, field-directed changes, ASI affecting price/schedule, T&M work, unforeseen conditions, or owner/architect verbal changes — note PCO/COR may be required before proceeding.',
    dailyReportIdx >= 0
      ? `DAILY REPORT STANDARD: ${clip(guideText.slice(dailyReportIdx, dailyReportIdx + 520), 420)}`
      : 'DAILY REPORT STANDARD: Legal record of date, weather, manpower, work performed, deliveries, visitors, issues, and verbal directions.',
    'TERMINOLOGY: Use correct commercial construction terms in all generated output.',
  ].join('\n\n');
}

async function extractText(filePath) {
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value.trim();
}

async function loadKnowledge() {
  if (SUPERINTENDENT_GUIDE && CONSTRUCTION_GLOSSARY) {
    return { SUPERINTENDENT_GUIDE, CONSTRUCTION_GLOSSARY };
  }

  const [guide, glossary] = await Promise.all([
    extractText(GUIDE_PATH),
    extractText(GLOSSARY_PATH),
  ]);

  SUPERINTENDENT_GUIDE = guide;
  CONSTRUCTION_GLOSSARY = glossary;

  module.exports.SUPERINTENDENT_GUIDE = SUPERINTENDENT_GUIDE;
  module.exports.CONSTRUCTION_GLOSSARY = CONSTRUCTION_GLOSSARY;

  return { SUPERINTENDENT_GUIDE, CONSTRUCTION_GLOSSARY };
}

loadPromise = loadKnowledge().catch((err) => {
  console.error('Failed to load knowledge documents:', err);
  throw err;
});

module.exports = {
  loadKnowledge,
  loadPromise,
  summarizeGlossary,
  summarizeSuperintendentGuide,
  SUPERINTENDENT_GUIDE,
  CONSTRUCTION_GLOSSARY,
};
