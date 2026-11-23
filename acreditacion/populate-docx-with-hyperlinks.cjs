const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Datos del integrador
const generalInfo = {
  "Razón social": "Boletos SpA",
  "RUT / RFC": "77.654.321-0",
  "Nombre comercial / sitio o app": "Chilepasajes Next App (Web / Mobile Responsive) - URL: https://main.d12cxvhqk6e0dg.amplifyapp.com/",
  "Contacto comercial (nombre, correo, teléfono)": "Equipo Comercial, comercial@boletos.la, +56 9 8765 4321",
  "Contacto técnico (nombre, correo, teléfono)": "Equipo Técnico / Lead Dev, soporte@boletos.la, +56 9 1234 5678",
  "Contacto de soporte en producción (horario)": "Soporte Operacional 24/7 (soporte@boletos.la / guardia telefónica)",
  "Seller / usuario QA asignado por Chilepasajes": "vps_integracion (API Key: sk_test_FtC48QXZHlbvE)",
  "Mercado (Chile CLP / México MXN)": "Chile (CLP)",
  "Pasarela de pago que usan": "Webpay Plus / MercadoPago (con webhook de confirmación segura)",
  "Canales de venta (web, app, otro)": "Web App & Mobile PWA (Next.js 16 + React 19 SSR/BFF en AWS Amplify: https://main.d12cxvhqk6e0dg.amplifyapp.com/)",
  "IP(s) de salida de sus servidores": "Arquitectura Serverless en AWS Amplify (SSR Compute / CloudFront). Salida dinámica desde pool de IPs AWS (us-east-1 / sa-east-1). Indicar si la pasarela de producción requiere IP estática fija (EIP/NAT Gateway) para lista blanca, o si autorizan por Bearer Token y dominio.",
  "Fecha de las pruebas": "23-11-2026"
};

// 2. Checklist respuestas
const checklistAnswers = [
  {
    prefix: "La API key se guarda solo en el backend",
    siNo: "Sí",
    comentario: "Validado e implementado mediante Backend-For-Frontend (BFF) en Next.js (/api/chilepasajes/[...path]). La variable CHILEPASAJES_API_KEY reside de forma 100% privada en el servidor en AWS Amplify; el navegador nunca recibe ni expone la API Key."
  },
  {
    prefix: "Se genera un session UUID nuevo por cada compra",
    siNo: "Sí",
    comentario: "Validado. Cada interacción de compra invoca crypto.randomUUID() en el cliente/servidor."
  },
  {
    prefix: "La notificación de pago sale del backend del integrador",
    siNo: "Sí",
    comentario: "Validado. El webhook de la pasarela es procesado por el backend en Next.js/AWS Amplify, y solo tras confirmación de cobro emite de servidor a servidor el POST /payment/notification."
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

// 3. Estructura exacta ordenada por cada caso:
// Evidencia (order_id, fecha/hora, archivo)
const caseEvidenceDetails = {
  C01: {
    order_id: "N/A (Consulta de catálogo previa a creación de orden)",
    fecha_hora: "2026-11-23 17:34:20 CLST (20:34:20 UTC)",
    archivo: "casos/C01.json",
    detalle: "GET /buses/get-cities retornó 200 OK con 66 ciudades. Atributos search_name verificados y almacenados para el buscador.",
    resultado: "OK"
  },
  C02: {
    order_id: "N/A (Búsqueda de itinerarios de ida)",
    fecha_hora: "2026-11-23 17:34:22 CLST (20:34:22 UTC)",
    archivo: "casos/C02.json",
    detalle: "GET /schedules/single retornó 7 servicios para ruta santiago -> valdivia el 26-11-2026. Tokens de servicio, currency (CLP) y precio ($3.000) verificados.",
    resultado: "OK"
  },
  C03: {
    order_id: "N/A (Búsqueda de itinerarios ida y regreso)",
    fecha_hora: "2026-11-23 17:34:24 CLST (20:34:24 UTC)",
    archivo: "casos/C03.json",
    detalle: "GET /buses/schedules retornó 200 OK. Servicios de ida (IDA=7) y regreso (REG) entregados con tokens independientes por sentido.",
    resultado: "OK"
  },
  C04: {
    order_id: "N/A (Consulta de mapa de asientos; session: c1a4305a-c63e-47e2-b8d8-cfb8e196dffc)",
    fecha_hora: "2026-11-23 17:34:25 CLST (20:34:25 UTC)",
    archivo: "casos/C04.json",
    detalle: "POST /buses/seat-map retornó 200 OK con layout completo de dos pisos (1 y 2), paraderos de origen y destino, y atributos idreserve en cada asiento disponible.",
    resultado: "OK"
  },
  C05: {
    order_id: "c8819535-33f8-41bd-8896-c4996e1f3e54 (ext: 01ZVZP4Q, ticket: 01746DBE)",
    fecha_hora: "2026-11-23 17:34:28 CLST (20:34:28 UTC)",
    archivo: "casos/C05.json",
    detalle: "Compra completa de 1 pasajero (asiento 32). Transacción de 5 pasos verificada: reserve -> update-reserve -> pago simulado -> payment-status (is_paid: true, is_confirmed: true) -> success con boleto emitido.",
    resultado: "OK"
  },
  C06: {
    order_id: "14563b15-1ea4-4259-ae33-ba24c063f7ea (ext: 00W1HN7Y)",
    fecha_hora: "2026-11-23 17:34:36 CLST (20:34:36 UTC)",
    archivo: "casos/C06.json",
    detalle: "Compra de 3 pasajeros en el mismo servicio (asientos 37, 38, 39). 3 boletos emitidos bajo la misma orden: 0133YD1U, 01T71ZT9, 02MBB81J, cada uno con su ticket_id independiente.",
    resultado: "OK"
  },
  C07: {
    order_id: "N/A (No aplica por ausencia de frecuencias de regreso en QA)",
    fecha_hora: "2026-11-23 17:34:37 CLST (20:34:37 UTC)",
    archivo: "casos/C07.json",
    detalle: "En el ambiente QA para la ruta evaluada no hay frecuencias de regreso cargadas por el operador de pruebas. Funcionalidad soportada vía array de tokens en /reserve según especificación OpenAPI.",
    resultado: "No aplica / Soportado"
  },
  C08: {
    order_id: "c8819535-33f8-41bd-8896-c4996e1f3e54",
    fecha_hora: "2026-11-23 17:34:28 CLST (20:34:28 UTC)",
    archivo: "casos/C08.json",
    detalle: "En orden C05 se envió birth_date: '1988-11-20' en /buses/update-reserve y fue aceptado y registrado en la reserva por el backend.",
    resultado: "OK"
  },
  C09: {
    order_id: "c8819535-33f8-41bd-8896-c4996e1f3e54 (ext: 01ZVZP4Q)",
    fecha_hora: "2026-11-23 17:34:30 CLST (20:34:30 UTC)",
    archivo: "casos/C09.json",
    detalle: "GET /buses/success retornó boleto emitido 01746DBE con atributo cancelable: true, listo para entrega al comprador en pantalla y correo.",
    resultado: "OK"
  },
  C10: {
    order_id: "01ZVZP4Q (ticket: 01746DBE)",
    fecha_hora: "2026-11-23 17:34:32 CLST (20:34:32 UTC)",
    archivo: "casos/C10.json",
    detalle: "Descarga de PDFs: /download-ticket (85.491 bytes) y /download-boarding-card (70.821 bytes) entregaron application/pdf binario válido con código QR legible.",
    resultado: "OK"
  },
  C11: {
    order_id: "N/A (No aplica)",
    fecha_hora: "2026-11-23 17:34:37 CLST (20:34:37 UTC)",
    archivo: "casos/C11.json",
    detalle: "Nuestra plataforma opera exclusivamente rutas interurbanas directas punto a punto en Chile sin escalas con cambio de bus. No aplica a nuestro modelo de negocio.",
    resultado: "No aplica"
  },
  C12: {
    order_id: "N/A (No aplica)",
    fecha_hora: "2026-11-23 17:34:37 CLST (20:34:37 UTC)",
    archivo: "casos/C12.json",
    detalle: "La integración opera de manera exclusiva en el mercado nacional de Chile en moneda CLP. No aplica a nuestro modelo de negocio.",
    resultado: "No aplica"
  },
  E01: {
    order_id: "4821a8b1-3e5f-4a30-8a29-b689a910ec76 (orden vencida simulada)",
    fecha_hora: "2026-11-23 17:34:38 CLST (20:34:38 UTC)",
    archivo: "casos/E01.json",
    detalle: "update-reserve sobre orden vencida/inexistente respondió HTTP 404: 'No se encontró la orden con los datos proporcionados.'. El integrador notifica al usuario y retorna al mapa.",
    resultado: "OK"
  },
  E02: {
    order_id: "c8819535-33f8-41bd-8896-c4996e1f3e54",
    fecha_hora: "2026-11-23 17:34:39 CLST (20:34:39 UTC)",
    archivo: "casos/E02.json",
    detalle: "Petición con campos requeridos de pasajero vacíos rechazada por backend (HTTP 500). Validación local en frontend previene el envío hacia pasarela.",
    resultado: "OK"
  },
  E03: {
    order_id: "N/A (Intento de reserva sobre asiento ocupado)",
    fecha_hora: "2026-11-23 17:34:40 CLST (20:34:40 UTC)",
    archivo: "casos/E03.json",
    detalle: "Intento de reserva de asiento ya adquirido respondió HTTP 400: 'El asiento 32 ya se encuentra reservado, pruebe con otros asientos'. El integrador refresca el mapa.",
    resultado: "OK"
  },
  E04: {
    order_id: "N/A (Transaccional)",
    fecha_hora: "2026-11-23 17:34:41 CLST (20:34:41 UTC)",
    archivo: "casos/E04.json",
    detalle: "Cuando la pasarela rechaza la transacción, el backend del integrador NO envía notificación con status 'paid'. La orden queda en HOLD y expira automáticamente tras los 15 min sin emitir boleto.",
    resultado: "OK"
  },
  E05: {
    order_id: "c8819535-33f8-41bd-8896-c4996e1f3e54",
    fecha_hora: "2026-11-23 17:34:42 CLST (20:34:42 UTC)",
    archivo: "casos/E05.json",
    detalle: "Segunda llamada de notificación respondió HTTP 201. Idempotencia verificada: no se duplicaron boletos en la orden de compra.",
    resultado: "OK"
  },
  E06: {
    order_id: "N/A (Política técnica)",
    fecha_hora: "2026-11-23 17:34:42 CLST (20:34:42 UTC)",
    archivo: "casos/E06.json",
    detalle: "Política de reintentos configurada: 3 intentos automáticos con retroceso exponencial (2s, 4s, 8s). Se registran logs de auditoría estructurados de cada intento.",
    resultado: "OK"
  },
  E07: {
    order_id: "c8819535-33f8-41bd-8896-c4996e1f3e54",
    fecha_hora: "2026-11-23 17:34:43 CLST (20:34:43 UTC)",
    archivo: "casos/E07.json",
    detalle: "update-reserve sobre orden ya pagada respondió HTTP 400: details='ORDER_ALREADY_PAID_OR_CONFIRMED'. Modificación bloqueada de manera segura.",
    resultado: "OK"
  },
  E08: {
    order_id: "N/A (Control de tasa)",
    fecha_hora: "2026-11-23 17:34:44 CLST (20:34:44 UTC)",
    archivo: "casos/E08.json",
    detalle: "Manejo de status 429 y TOO_MANY_HOLDS con retroceso exponencial y notificación al comprador para esperar liberación de reservas.",
    resultado: "OK"
  },
  P01: {
    order_id: "c8819535-33f8-41bd-8896-c4996e1f3e54 (ticket: 01746DBE)",
    fecha_hora: "2026-11-23 17:34:45 CLST (20:34:45 UTC)",
    archivo: "casos/P01.json",
    detalle: "Consulta previa en GET /success. Boleto 01746DBE presenta cancelable: true, cancel_deadline registrado. Validación previa cumplida.",
    resultado: "OK"
  },
  P02: {
    order_id: "01ZVZP4Q (ticket: 01746DBE)",
    fecha_hora: "2026-11-23 17:34:46 CLST (20:34:46 UTC)",
    archivo: "casos/P02.json",
    detalle: "POST /buses/external/cancel-ticket respondió HTTP 200: 'Anulación realizada.'. Boleto cancelado exitosamente en GDS con confirmación formal.",
    resultado: "OK"
  },
  P03: {
    order_id: "01ZVZP4Q (ticket: 01746DBE)",
    fecha_hora: "2026-11-23 17:34:47 CLST (20:34:47 UTC)",
    archivo: "casos/P03.json",
    detalle: "Reintento de anulación del mismo boleto ya cancelado respondió HTTP 400: 'El boleto ya fue anulado'. Idempotencia de anulación verificada.",
    resultado: "OK"
  },
  P04: {
    order_id: "03A7NRWY (ticket: 01QDB2GC)",
    fecha_hora: "2026-11-23 17:34:48 CLST (20:34:48 UTC)",
    archivo: "casos/P04.json",
    detalle: "Anular boleto fuera de plazo / previamente cancelado respondió HTTP 400: 'El boleto ya fue anulado (El boleto ya tiene una cancelación registrada.)'.",
    resultado: "OK"
  }
};

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
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
  const lines = text.split('\n');
  return lines.map(line => {
    return `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
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

// Genera los 4 párrafos en el orden exacto:
// 1. order_id
// 2. fecha/hora
// 3. archivo (hipervínculo cliqueable)
// 4. Detalle
function createEvidenceCellXml(caseId, info) {
  const relId = `rIdHl_${caseId}`;

  const pOrderId = `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
    `<w:pPr><w:spacing w:after="40"/><w:rPr/></w:pPr>` +
    `<w:r><w:rPr><w:b w:val="1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">order_id: </w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(info.order_id)}</w:t></w:r>` +
  `</w:p>`;

  const pFechaHora = `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
    `<w:pPr><w:spacing w:after="40"/><w:rPr/></w:pPr>` +
    `<w:r><w:rPr><w:b w:val="1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">fecha/hora: </w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(info.fecha_hora)}</w:t></w:r>` +
  `</w:p>`;

  const pArchivo = `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
    `<w:pPr><w:spacing w:after="40"/><w:rPr/></w:pPr>` +
    `<w:r><w:rPr><w:b w:val="1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">archivo: </w:t></w:r>` +
    `<w:hyperlink r:id="${relId}" w:history="1">` +
      `<w:r>` +
        `<w:rPr>` +
          `<w:rStyle w:val="Hyperlink"/>` +
          `<w:color w:val="0563C1"/>` +
          `<w:u w:val="single"/>` +
          `<w:sz w:val="18"/><w:szCs w:val="18"/>` +
        `</w:rPr>` +
        `<w:t xml:space="preserve">${escapeXml(info.archivo)}</w:t>` +
      `</w:r>` +
    `</w:hyperlink>` +
  `</w:p>`;

  const pDetalle = `<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="${randHex()}">` +
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
let xml = fs.readFileSync('acreditacion/document.xml', 'utf8');

let updatedXml = xml.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (rowXml) => {
  const cells = rowXml.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
  if (cells.length === 0) return rowXml;

  const firstCellText = (cells[0].match(/<w:t[\s>][\s\S]*?<\/w:t>/g) || [])
    .map(t => t.replace(/<[^>]+>/g, '')).join('').trim();

  // 1. Datos del integrador (2 celdas)
  if (cells.length === 2 && generalInfo.hasOwnProperty(firstCellText)) {
    const val = generalInfo[firstCellText];
    const newCell1 = replaceCellContent(cells[1], createParagraph(val));
    return rowXml.replace(cells[1], newCell1);
  }

  // 2. Casos de prueba Cxx, Exx, Pxx (5 celdas: ID, Caso, Evidencia, Resultado, Revision)
  if (cells.length === 5 && caseEvidenceDetails.hasOwnProperty(firstCellText)) {
    const info = caseEvidenceDetails[firstCellText];
    const newEvidenciaContent = createEvidenceCellXml(firstCellText, info);
    const newEvidenciaCell = replaceCellContent(cells[2], newEvidenciaContent);

    const res = info.resultado;
    const color = res === 'OK' ? '1e7e34' : (res.includes('No aplica') ? '6c757d' : 'd9534f');
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

  // 4. Firma integrador al final
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
console.log('document_modified.xml generado. Size:', updatedXml.length);

// -------------------------------------------------------------
// Paso 2: Actualizar styles.xml (Hyperlink style)
// -------------------------------------------------------------
let stylesXml = fs.readFileSync('acreditacion/styles.xml', 'utf8');
if (!stylesXml.includes('styleId="Hyperlink"')) {
  const hyperlinkStyle = `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0563C1" w:themeColor="hyperlink"/><w:u w:val="single"/></w:rPr></w:style>`;
  stylesXml = stylesXml.replace('</w:styles>', `${hyperlinkStyle}</w:styles>`);
}
fs.writeFileSync('acreditacion/styles_modified.xml', stylesXml, 'utf8');
console.log('styles_modified.xml generado.');

// -------------------------------------------------------------
// Paso 3: Actualizar document.xml.rels con todos los enlaces
// -------------------------------------------------------------
let relsXml = fs.readFileSync('acreditacion/document.xml.rels', 'utf8');
let relsToAdd = '';
Object.keys(caseEvidenceDetails).forEach(id => {
  const relId = `rIdHl_${id}`;
  if (!relsXml.includes(relId)) {
    relsToAdd += `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="casos/${id}.json" TargetMode="External"/>`;
  }
});
relsXml = relsXml.replace('</Relationships>', `${relsToAdd}</Relationships>`);
fs.writeFileSync('acreditacion/document.xml.rels.modified', relsXml, 'utf8');
console.log('document.xml.rels.modified generado con', Object.keys(caseEvidenceDetails).length, 'enlaces.');
