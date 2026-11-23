const fs = require('fs');

const xml = fs.readFileSync('acreditacion/document_modified.xml', 'utf8');
const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
const rows = xml.match(trRegex) || [];

console.log('--- SAMPLE VERIFICATION OF MODIFIED ROWS ---');
[0, 1, 6, 7, 13, 17, 18, 26, 36, 40, 41, 57, 58].forEach(idx => {
  const row = rows[idx];
  const tcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
  const cells = row.match(tcRegex) || [];
  const texts = cells.map(c => {
    return (c.match(/<w:t[\s>][\s\S]*?<\/w:t>/g) || [])
      .map(t => t.replace(/<[^>]+>/g, '')).join('').trim();
  });
  console.log(`Row ${idx}:`, JSON.stringify(texts));
});
