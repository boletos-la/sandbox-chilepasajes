const fs = require('fs');
const s = fs.readFileSync('acreditacion/styles.xml', 'utf8');
console.log('Includes Hyperlink:', s.includes('Hyperlink'));
console.log('Style IDs:', (s.match(/w:styleId="[^"]+"/g) || []).join(', '));
