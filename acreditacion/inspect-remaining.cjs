const fs = require('fs');

const xml = fs.readFileSync('acreditacion/document.xml', 'utf8');
const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
const rows = xml.match(trRegex) || [];

rows.slice(25).forEach((row, i) => {
  const texts = [];
  const tcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
  const cells = row.match(tcRegex) || [];
  cells.forEach(c => {
    const tMatches = c.match(/<w:t[\s>][\s\S]*?<\/w:t>/g) || [];
    const text = tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
    texts.push(text.trim());
  });
  console.log(`Row ${i + 25} (${cells.length} cells):`, JSON.stringify(texts));
});
