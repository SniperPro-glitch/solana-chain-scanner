const fs = require('fs');
const p = require('path').join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');
const before = (s.match(/motion/g) || []).length;
s = s.split('motion').join('div');
fs.writeFileSync(p, s);
console.log('replaced', before, 'occurrences');
