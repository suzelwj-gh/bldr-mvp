const path = require('path');
const mammoth = require('mammoth');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const GUIDE_PATH = path.join(KNOWLEDGE_DIR, 'ARI_Superintendent_Knowledge_Guide.docx');
const GLOSSARY_PATH = path.join(KNOWLEDGE_DIR, 'CPJ_Ari_Construction_Terms_Glossary.docx');

let SUPERINTENDENT_GUIDE = '';
let CONSTRUCTION_GLOSSARY = '';
let loadPromise;

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
  SUPERINTENDENT_GUIDE,
  CONSTRUCTION_GLOSSARY,
};
