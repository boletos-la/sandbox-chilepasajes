const fs = require('fs');

const xml = fs.readFileSync('acreditacion/document_modified.xml', 'utf8');
const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
const rows = xml.match(trRegex) || [];

console.log('--- VERIFICATION OF MODIFIED ROW C01 ---');
console.log('Row 13 (C01):');
const cellsC01 = rows[13].match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
console.log('Evidencia XML C01:');
console.log(cellsC01[2]);

console.log('\n--- VERIFICATION OF MODIFIED ROW C05 ---');
console.log('Row 17 (C05):');
const cellsC05 = rows[17].match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
console.log('Evidencia XML C05:');
console.log(cellsC05[2]);

console.log('\n--- VERIFICATION OF MODIFIED ROW P02 ---');
console.log('Row 36 (P02):');
const cellsP02 = rows[36].match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
console.log('Evidencia XML P02:');
console.log(cellsP02[2]);
