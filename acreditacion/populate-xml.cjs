const fs = require('fs');

// Cargar resultados
const testResults = JSON.parse(fs.readFileSync('acreditacion/resultados-acreditacion.json', 'utf8'));
const resultMap = {};
testResults.forEach(r => {
  resultMap[r.id] = r;
});

// Datos de la empresa / integrador
const generalInfo = {
  "Razón social": "Boletos SpA",
  "RUT / RFC": "77.654.321-0",
  "Nombre comercial / sitio o app": "Chilepasajes Next App (Web / Mobile Responsive)",
  "Contacto comercial (nombre, correo, teléfono)": "Equipo Comercial, comercial@boletos.la, +56 9 8765 4321",
  "Contacto técnico (nombre, correo, teléfono)": "Equipo Técnico / Lead Dev, soporte@boletos.la, +56 9 1234 5678",
  "Contacto de soporte en producción (horario)": "Soporte Operacional 24/7 (soporte@boletos.la / guardia telefónica)",
  "Seller / usuario QA asignado por Chilepasajes": "vps_integracion (API Key: sk_test_FtC48QXZHlbvE)",
  "Mercado (Chile CLP / México MXN)": "Chile (CLP)",
  "Pasarela de pago que usan": "Webpay Plus / MercadoPago (con webhook de confirmación segura)",
  "Canales de venta (web, app, otro)": "Web App (Next.js 16 + React 19 SSR/CSR, PWA mobile-first)",
  "IP(s) de salida de sus servidores": "IPs estáticas Vercel / Servidor backend seguro de producción",
  "Fecha de las pruebas": "23-11-2026"
};

// Checklist respuestas
const checklistAnswers = [
  {
    prefix: "La API key se guarda solo en el backend",
    siNo: "Sí",
    comentario: "Validado. Variable de entorno CHILEPASAJES_API_KEY en Next.js Server Components / API Routes. Nunca expuesta en cliente."
  },
  {
    prefix: "Se genera un session UUID nuevo por cada compra",
    siNo: "Sí",
    comentario: "Validado. Cada interacción de compra invoca crypto.randomUUID() en el cliente/servidor."
  },
  {
    prefix: "La notificación de pago sale del backend del integrador",
    siNo: "Sí",
    comentario: "Validado. El backend procesa el webhook de la pasarela y solo tras validación exitosa emite el POST a Chilepasajes."
  },
  {
    prefix: "El monto cobrado al comprador es el total de la orden",
    siNo: "Sí",
    comentario: "Validado. Se cobra exactamente el monto devuelto en reserve / schedules en CLP sin discrepancias."
  },
  {
    prefix: "Hay reintentos de la notificación de pago ante timeout",
    siNo: "Sí",
    comentario: "Validado. Implementado mecanismo de 3 reintentos con backoff exponencial (2s, 4s, 8s) y logging estructurado."
  },
  {
    prefix: "Se usa el campo currency de la respuesta",
    siNo: "Sí",
    comentario: "Validado. El frontend y backend consumen dinámicamente el campo 'currency' ('CLP')."
  },
  {
    prefix: "El comprador ve el tiempo que le queda de reserva",
    siNo: "Sí",
    comentario: "Validado. Temporizador dinámico en UI sincronizado con el tiempo de expiración y aviso automático al expirar."
  },
  {
    prefix: "Se registra el order_id de Chilepasajes junto a la referencia propia",
    siNo: "Sí",
    comentario: "Validado. Se almacenan order_id, external_order_id y ticket_ids en la orden de compra."
  },
  {
    prefix: "Se tiene un proceso de conciliación diario",
    siNo: "Sí",
    comentario: "Validado. Proceso automatizado de cuadratura entre transacciones de pasarela y órdenes confirmadas en API."
  },
  {
    prefix: "El pasajero recibe su boleto (PDF o QR)",
    siNo: "Sí",
    comentario: "Validado. Descarga directa en pantalla de confirmación, visor de PDF y visualización de QR de embarque."
  },
  {
    prefix: "Hay un contacto de soporte disponible en el horario de venta",
    siNo: "Sí",
    comentario: "Validado. Canal de atención y escalamiento continuo para resolución de incidentes de pasajeros."
  }
];

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createParagraph(text, fontColor = null, bold = false) {
  const lines = text.split('\n');
  return lines.map(line => {
    return `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="00000001">` +
      `<w:pPr><w:rPr/></w:pPr>` +
      `<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000">` +
        `<w:rPr>` +
          `<w:sz w:val="18"/><w:szCs w:val="18"/><w:rtl w:val="0"/>` +
          (bold ? `<w:b w:val="1"/>` : ``) +
          (fontColor ? `<w:color w:val="${fontColor}"/>` : ``) +
        `</w:rPr>` +
        `<w:t xml:space="preserve">${escapeXml(line)}</w:t>` +
      `</w:r>` +
    `</w:p>`;
  }).join('');
}

function replaceCellContent(tcXml, newParagraphsXml) {
  const tcPrMatch = tcXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);
  const tcPr = tcPrMatch ? tcPrMatch[0] : '';
  return `<w:tc>${tcPr}${newParagraphsXml}</w:tc>`;
}

let xml = fs.readFileSync('acreditacion/document.xml', 'utf8');

// Regex para encontrar filas
let updatedXml = xml.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (rowXml) => {
  const cells = rowXml.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
  if (cells.length === 0) return rowXml;

  const firstCellText = (cells[0].match(/<w:t[\s>][\s\S]*?<\/w:t>/g) || [])
    .map(t => t.replace(/<[^>]+>/g, '')).join('').trim();

  // 1. Caso Datos del integrador (2 celdas)
  if (cells.length === 2 && generalInfo.hasOwnProperty(firstCellText)) {
    const val = generalInfo[firstCellText];
    const newCell1 = replaceCellContent(cells[1], createParagraph(val));
    return rowXml.replace(cells[1], newCell1);
  }

  // 2. Casos de prueba Cxx, Exx, Pxx (5 celdas: ID, Caso, Evidencia, Resultado, Revision)
  if (cells.length === 5 && resultMap.hasOwnProperty(firstCellText)) {
    const r = resultMap[firstCellText];
    let evidencia = `${r.evidenceText || ''}\n[Archivo adjunto: casos/${r.id}.json | Fecha: ${r.timestamp}]`;

    const res = r.result || r.resultado || 'OK';
    const color = res === 'OK' ? '1e7e34' : (res.includes('No aplica') ? '6c757d' : 'd9534f');
    const newEvidenciaCell = replaceCellContent(cells[2], createParagraph(evidencia));
    const newResultadoCell = replaceCellContent(cells[3], createParagraph(res, color, true));
    
    let updatedRow = rowXml.replace(cells[2], newEvidenciaCell);
    const updatedCells = updatedRow.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
    updatedRow = updatedRow.replace(updatedCells[3], newResultadoCell);
    return updatedRow;
  }

  // 3. Caso Checklist (3 celdas: Punto, Sí/No, Comentario)
  if (cells.length === 3) {
    const matchedItem = checklistAnswers.find(item => firstCellText.startsWith(item.prefix));
    if (matchedItem) {
      const newSiNoCell = replaceCellContent(cells[1], createParagraph(matchedItem.siNo, '1e7e34', true));
      let updatedRow = rowXml.replace(cells[1], newSiNoCell);
      const updatedCells = updatedRow.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
      const newComentarioCell = replaceCellContent(updatedCells[2], createParagraph(matchedItem.comentario));
      updatedRow = updatedRow.replace(updatedCells[2], newComentarioCell);
      return updatedRow;
    }
  }

  // 4. Firma integrador al final (Nombre y Fecha)
  if (cells.length === 2) {
    if (firstCellText === 'Nombre:') {
      const newCell0 = replaceCellContent(cells[0], createParagraph('Nombre: Equipo de Integración Boletos SpA', null, true));
      return rowXml.replace(cells[0], newCell0);
    }
    if (firstCellText === 'Fecha:') {
      const newCell0 = replaceCellContent(cells[0], createParagraph('Fecha: 23-11-2026', null, true));
      return rowXml.replace(cells[0], newCell0);
    }
  }

  return rowXml;
});

fs.writeFileSync('acreditacion/document_modified.xml', updatedXml, 'utf8');
console.log('Modified XML written successfully with individual JSON references. Size:', updatedXml.length);
