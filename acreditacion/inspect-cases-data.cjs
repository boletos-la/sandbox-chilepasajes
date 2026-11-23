const fs = require('fs');
const path = require('path');

const casosDir = 'acreditacion/casos';
const files = fs.readdirSync(casosDir);

const caseMap = {};

files.forEach(f => {
  if (!f.endsWith('.json')) return;
  const id = f.replace('.json', '');
  const content = JSON.parse(fs.readFileSync(path.join(casosDir, f), 'utf8'));
  caseMap[id] = content;
});

console.log('Loaded cases:', Object.keys(caseMap));
console.log('Sample C05:', {
  test_id: caseMap['C05']?.test_id,
  order_id: caseMap['C05']?.steps?.step1_reserve?.response?.response?.order?.order_id,
  executed_at: caseMap['C05']?.executed_at
});
console.log('Sample C06:', {
  order_id: caseMap['C06']?.order_id,
  executed_at: caseMap['C06']?.executed_at
});
