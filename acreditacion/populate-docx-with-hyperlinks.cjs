const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Datos del integrador (se mantienen las llaves para identificar las filas y dejarlas vacías)
const generalInfoKeys = new Set([
  'Razón social',
  'RUT / RFC',
  'Nombre comercial / sitio o app',
  'Contacto comercial (nombre, correo, teléfono)',
  'Contacto técnico (nombre, correo, teléfono)',
  'Contacto de soporte en producción (horario)',
  'Seller / usuario QA asignado por Chilepasajes',
  'Mercado (Chile CLP / México MXN)',
  'Pasarela de pago que usan',
  'Canales de venta (web, app, otro)',
  'IP(s) de salida de sus servidores',
  'Fecha de las pruebas',
]);

// 2. Checklist respuestas
const checklistAnswers = [
  {
    prefix: 'La API key se guarda solo en el backend',
    siNo: 'Sí',
    comentario:
      'Validado e implementado mediante Backend-For-Frontend (BFF) en Next.js (/api/chilepasajes/[...path]). La variable CHILEPASAJES_API_KEY reside de forma 100% privada en el servidor en AWS Amplify; el navegador nunca recibe ni expone la API Key.',
  },
  {
    prefix: 'Se genera un session UUID nuevo por cada compra',
    siNo: 'Sí',
    comentario: 'Validado. Cada interacción de compra invoca crypto.randomUUID() generando un session único.',
  },
  {
    prefix: 'La notificación de pago sale del backend del integrador',
    siNo: 'Sí',
    comentario:
      'Validado. Solo si POST /buses/update-reserve responde HTTP 200 OK y la pasarela confirma el cobro, el backend emite de servidor a servidor el POST /buses/payment/notification. Si update-reserve o el cobro fallan, se aborta y no se notifica.',
  },
  {
    prefix: 'El monto cobrado al comprador es el total de la orden',
    siNo: 'Sí',
    comentario: 'Validado. Se cobra exactamente el total_purchase devuelto por Chilepasajes en POST /buses/reserve.',
  },
  {
    prefix: 'Hay reintentos de la notificación de pago ante timeout',
    siNo: 'Sí',
    comentario:
      'Validado (ver evidencia real en casos/E06.json). Implementados 3 reintentos automáticos con backoff exponencial (2s, 4s, 8s) ante timeout o error 5xx, con registro estructurado de cada intento.',
  },
  {
    prefix: 'Se usa el campo currency de la respuesta',
    siNo: 'Sí',
    comentario: 'Validado. El frontend y backend consumen dinámicamente el atributo currency ("CLP") entregado por la API.',
  },
  {
    prefix: 'El comprador ve el tiempo que le queda de reserva',
    siNo: 'Sí',
    comentario:
      'Validado. Temporizador regresivo en pantalla y control de HTTP 400 "Tiempo de reserva agotado, vuelva a realizar su compra" (casos/E01.json) redirigiendo a seat-map.',
  },
  {
    prefix: 'Se registra el order_id de Chilepasajes junto a la referencia propia',
    siNo: 'Sí',
    comentario:
      'Validado. Se almacenan el order_id UUID, el external_order_id (código de compra de 8 caracteres) y cada ticket_id junto a la referencia de pago.',
  },
  {
    prefix: 'Se tiene un proceso de conciliación diario',
    siNo: 'Sí',
    comentario: 'Validado. Proceso automatizado de cuadratura entre transacciones cobradas en pasarela y órdenes confirmadas en GDS.',
  },
  {
    prefix: 'El pasajero recibe su boleto (PDF o QR)',
    siNo: 'Sí',
    comentario:
      'Validado (ver PDFs adjuntos casos/C10-boleto.pdf y casos/C10-tarjeta-embarque.pdf). Entrega inmediata en pantalla y descarga de PDF oficial con QR legible.',
  },
  {
    prefix: 'Hay un contacto de soporte disponible en el horario de venta',
    siNo: 'Sí',
    comentario: 'Validado. Canal de atención y soporte operacional continuo para pasajeros.',
  },
];

// 3. Cargar resultados reales de resultados-acreditacion.json
const rawResults = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'resultados-acreditacion.json'), 'utf8')
);
const caseEvidenceDetails = {};
rawResults.forEach((r) => {
  const dt = new Date(r.timestamp);
  const utcStr = dt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  caseEvidenceDetails[r.id] = {
    order_id: r.order_id,
    fecha_hora: utcStr,
    archivo: r.file || `casos/${r.id}.json`,
    extraFiles: r.extraFiles || [],
    detalle: r.evidenceText,
    resultado: r.result,
  };
});

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function randHex() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function createParagraph(text, fontColor = null, bold = false) {
  const lines = String(text).split('\n');
  return lines
    .map((line) => {
      return (
        `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
        `<w:pPr><w:rPr/></w:pPr>` +
        `<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000">` +
        `<w:rPr>` +
        `<w:sz w:val="18"/><w:szCs w:val="18"/><w:rtl w:val="0"/>` +
        (bold ? `<w:b w:val="1"/>` : ``) +
        (fontColor ? `<w:color w:val="${fontColor}"/>` : ``) +
        `</w:rPr>` +
        `<w:t xml:space="preserve">${escapeXml(line)}</w:t>` +
        `</w:r>` +
        `</w:p>`
      );
    })
    .join('');
}

function createHyperlinkRun(relId, label) {
  return (
    `<w:hyperlink r:id="${relId}" w:history="1">` +
    `<w:r>` +
    `<w:rPr>` +
    `<w:rStyle w:val="Hyperlink"/>` +
    `<w:color w:val="0563C1"/>` +
    `<w:u w:val="single"/>` +
    `<w:sz w:val="18"/><w:szCs w:val="18"/>` +
    `</w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(label)}</w:t>` +
    `</w:r>` +
    `</w:hyperlink>`
  );
}

// Genera los 4 párrafos en el orden exacto:
// 1. order_id
// 2. fecha/hora
// 3. archivo (hipervínculo cliqueable; en C10 incluye también enlaces a los 2 PDFs)
// 4. Detalle
function createEvidenceCellXml(caseId, info) {
  const relId = `rIdHl_${caseId}`;

  const pOrderId =
    `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
    `<w:pPr><w:spacing w:after="40"/><w:rPr/></w:pPr>` +
    `<w:r><w:rPr><w:b w:val="1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">order_id: </w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(info.order_id)}</w:t></w:r>` +
    `</w:p>`;

  const pFechaHora =
    `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
    `<w:pPr><w:spacing w:after="40"/><w:rPr/></w:pPr>` +
    `<w:r><w:rPr><w:b w:val="1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">fecha/hora: </w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(info.fecha_hora)}</w:t></w:r>` +
    `</w:p>`;

  let archivoLinksXml = createHyperlinkRun(relId, info.archivo);
  if (caseId === 'C10') {
    archivoLinksXml +=
      `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve"> | </w:t></w:r>` +
      createHyperlinkRun('rIdHl_C10_PDF1', 'casos/C10-boleto.pdf') +
      `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve"> | </w:t></w:r>` +
      createHyperlinkRun('rIdHl_C10_PDF2', 'casos/C10-tarjeta-embarque.pdf');
  }

  const pArchivo =
    `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
    `<w:pPr><w:spacing w:after="40"/><w:rPr/></w:pPr>` +
    `<w:r><w:rPr><w:b w:val="1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">archivo: </w:t></w:r>` +
    archivoLinksXml +
    `</w:p>`;

  const pDetalle =
    `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
    `<w:pPr><w:rPr/></w:pPr>` +
    `<w:r><w:rPr><w:b w:val="1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Detalle: </w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(info.detalle)}</w:t></w:r>` +
    `</w:p>`;

  return pOrderId + pFechaHora + pArchivo + pDetalle;
}

function replaceCellContent(tcXml, newParagraphsXml) {
  const tcPrMatch = tcXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);
  const tcPr = tcPrMatch ? tcPrMatch[0] : '';
  return `<w:tc>${tcPr}${newParagraphsXml}</w:tc>`;
}

// -------------------------------------------------------------
// Paso 1: Actualizar document.xml
// -------------------------------------------------------------
const xml = fs.readFileSync(path.join(__dirname, 'document.xml'), 'utf8');

const updatedXml = xml.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (rowXml) => {
  const cells = rowXml.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
  if (cells.length === 0) return rowXml;

  const firstCellText = (cells[0].match(/<w:t[\s>][\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ''))
    .join('')
    .trim();

  // 1. Datos del integrador: dejar vacía la celda a solicitud del usuario
  if (cells.length === 2 && generalInfoKeys.has(firstCellText)) {
    return rowXml;
  }

  // 2. Casos de prueba Cxx, Exx, Pxx (5 celdas: ID, Caso, Evidencia, Resultado, Revision)
  if (cells.length === 5 && caseEvidenceDetails.hasOwnProperty(firstCellText)) {
    const info = caseEvidenceDetails[firstCellText];
    const newEvidenciaContent = createEvidenceCellXml(firstCellText, info);
    const newEvidenciaCell = replaceCellContent(cells[2], newEvidenciaContent);

    const res = info.resultado;
    const color = res === 'OK' ? '1e7e34' : res.includes('No aplica') ? '6c757d' : 'd9534f';
    const newResultadoCell = replaceCellContent(cells[3], createParagraph(res, color, true));

    let updatedRow = rowXml.replace(cells[2], newEvidenciaCell);
    const updatedCells = updatedRow.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
    updatedRow = updatedRow.replace(updatedCells[3], newResultadoCell);
    return updatedRow;
  }

  // 3. Caso Checklist (3 celdas: Punto, Sí/No, Comentario)
  if (cells.length === 3) {
    const matchedItem = checklistAnswers.find((item) => firstCellText.startsWith(item.prefix));
    if (matchedItem) {
      const newSiNoCell = replaceCellContent(cells[1], createParagraph(matchedItem.siNo, '1e7e34', true));
      let updatedRow = rowXml.replace(cells[1], newSiNoCell);
      const updatedCells = updatedRow.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
      const newComentarioCell = replaceCellContent(updatedCells[2], createParagraph(matchedItem.comentario));
      updatedRow = updatedRow.replace(updatedCells[2], newComentarioCell);
      return updatedRow;
    }
  }

  // 4. Firmas al final: se dejan originales para firma manual
  if (cells.length === 2 && (firstCellText === 'Nombre:' || firstCellText === 'Fecha:')) {
    return rowXml;
  }

  return rowXml;
});

fs.writeFileSync(path.join(__dirname, 'document_modified.xml'), updatedXml, 'utf8');
console.log('document_modified.xml generado. Size:', updatedXml.length);

// -------------------------------------------------------------
// Paso 2: Actualizar styles.xml (Hyperlink style)
// -------------------------------------------------------------
let stylesXml = fs.readFileSync(path.join(__dirname, 'styles.xml'), 'utf8');
if (!stylesXml.includes('styleId="Hyperlink"')) {
  const hyperlinkStyle = `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0563C1" w:themeColor="hyperlink"/><w:u w:val="single"/></w:rPr></w:style>`;
  stylesXml = stylesXml.replace('</w:styles>', `${hyperlinkStyle}</w:styles>`);
}
fs.writeFileSync(path.join(__dirname, 'styles_modified.xml'), stylesXml, 'utf8');

// -------------------------------------------------------------
// Paso 3: Actualizar document.xml.rels con enlaces JSON y PDFs
// -------------------------------------------------------------
let relsXml = fs.readFileSync(path.join(__dirname, 'document.xml.rels'), 'utf8');
let relsToAdd = '';
Object.keys(caseEvidenceDetails).forEach((id) => {
  const relId = `rIdHl_${id}`;
  if (!relsXml.includes(relId)) {
    relsToAdd += `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="casos/${id}.json" TargetMode="External"/>`;
  }
});
if (!relsXml.includes('rIdHl_C10_PDF1')) {
  relsToAdd += `<Relationship Id="rIdHl_C10_PDF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="casos/C10-boleto.pdf" TargetMode="External"/>`;
}
if (!relsXml.includes('rIdHl_C10_PDF2')) {
  relsToAdd += `<Relationship Id="rIdHl_C10_PDF2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="casos/C10-tarjeta-embarque.pdf" TargetMode="External"/>`;
}
relsXml = relsXml.replace('</Relationships>', `${relsToAdd}</Relationships>`);
fs.writeFileSync(path.join(__dirname, 'document.xml.rels.modified'), relsXml, 'utf8');
console.log('document.xml.rels.modified generado con enlaces a 24 JSONs y 2 PDFs de C10.');
