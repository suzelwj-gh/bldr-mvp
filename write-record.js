const fs = require('fs');
const html = fs.readFileSync('public/record.html.bak', 'utf8');
console.log('size:', html.length);
