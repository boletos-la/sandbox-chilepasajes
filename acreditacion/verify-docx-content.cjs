const fs = require('fs');

const xml = fs.readFileSync('acreditacion/document_modified.xml', 'utf8');
const rows = xml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || [];

rows.forEach((row, idx) => {
  const cells = row.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
  if (cells.length === 5) {
    const texts = cells.map(c =>
      (c.match(/<w:t[\s>][\s\S]*?<\/w:t>/g) || [])
        .map(t => t.replace(/<[^>]+>/g, ''))
        .join('')
        .trim()
    );
    if (texts[0] !== 'ID') {
      console.log(`[${texts[0]}] Resultado=${texts[3]} | Evidencia: ${texts[2].slice(0, 180)}...`);
    }
  }
});
