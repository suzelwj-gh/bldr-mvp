const fs = require('fs');
let h = fs.readFileSync('public/record.html', 'utf8');
h = h.replace("if(!authToken){window.location.href='/login.html';}", "");
fs.writeFileSync('public/record.html', h);
console.log('done', fs.statSync('public/record.html').size);