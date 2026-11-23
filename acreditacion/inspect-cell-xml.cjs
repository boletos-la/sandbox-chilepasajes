const fs = require('fs');

const xml = fs.readFileSync('acreditacion/document.xml', 'utf8');
const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
const rows = xml.match(trRegex) || [];

console.log('Row 13 full XML:');
console.log(rows[13]);
