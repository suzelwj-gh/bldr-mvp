const PizZip = require('pizzip');
const fs = require('fs');
const files = ['BLDR_Daily_Construction_Report.docx','BLDR_RFI_Template.docx','BLDR_Issue_Tracker.docx'];
files.forEach(f => {
  const zip = new PizZip(fs.readFileSync('server/templates/' + f, 'binary'));
  const xml = zip.files['word/document.xml'].asText();
  const matches = [...xml.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]);
  console.log('\n--- ' + f + ' ---');
  console.log([...new Set(matches)].join('\n'));
});
