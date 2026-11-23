const fs = require('fs');

// 1. Verificar styles.xml
let stylesXml = fs.readFileSync('acreditacion/styles.xml', 'utf8');
if (!stylesXml.includes('styleId="Hyperlink"')) {
  const hyperlinkStyle = `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0563C1" w:themeColor="hyperlink"/><w:u w:val="single"/></w:rPr></w:style>`;
  stylesXml = stylesXml.replace('</w:styles>', `${hyperlinkStyle}</w:styles>`);
  fs.writeFileSync('acreditacion/styles_modified.xml', stylesXml, 'utf8');
  console.log('Hyperlink style added to styles_modified.xml');
}

// 2. Verificar document.xml.rels
let relsXml = fs.readFileSync('acreditacion/document.xml.rels', 'utf8');
const caseIds = [
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12',
  'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08',
  'P01', 'P02', 'P03', 'P04'
];

let relsToAdd = '';
caseIds.forEach(id => {
  const relId = `rIdHl_${id}`;
  if (!relsXml.includes(relId)) {
    relsToAdd += `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="casos/${id}.json" TargetMode="External"/>`;
  }
});

relsXml = relsXml.replace('</Relationships>', `${relsToAdd}</Relationships>`);
fs.writeFileSync('acreditacion/document.xml.rels.modified', relsXml, 'utf8');
console.log('Relationships added. Length:', relsXml.length);
