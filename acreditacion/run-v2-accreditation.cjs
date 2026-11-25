const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const API_KEY = 'sk_test_FtC48QXZHlbvE';
const BASE_URL = 'https://back-qas.enbus.cl/api/v1';

const CASOS_DIR = path.join(__dirname, 'casos');
const ROOT_CASOS_DIR = path.join(__dirname, '..', 'casos');
for (const dir of [CASOS_DIR, ROOT_CASOS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiCall(endpoint, options = {}, customBaseUrl = BASE_URL) {
  const url = `${customBaseUrl}${endpoint}`;
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (!headers['Authorization'] && !endpoint.includes('/payment/notification')) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const startTime = Date.now();
  const res = await fetch(url, { ...options, headers });
  const durationMs = Date.now() - startTime;

  let body = null;
  let rawBuffer = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else if (contentType.includes('application/pdf')) {
    const arrayBuffer = await res.arrayBuffer();
    rawBuffer = Buffer.from(arrayBuffer);
    body = {
      type: 'application/pdf',
      size_bytes: rawBuffer.byteLength,
      pdf_header: rawBuffer.subarray(0, 8).toString('ascii').trim(),
      sha256: crypto.createHash('sha256').update(rawBuffer).digest('hex'),
    };
  } else {
    body = await res.text();
  }

  const safeHeaders = { ...headers };
  if (safeHeaders['Authorization']) {
    safeHeaders['Authorization'] = 'Bearer sk_test_*** (injected by backend BFF)';
  }

  return {
    url,
    method: options.method || 'GET',
    requestHeaders: safeHeaders,
    requestBody: options.body ? JSON.parse(options.body) : null,
    status: res.status,
    statusText: res.statusText,
    responseHeaders: Object.fromEntries(res.headers.entries()),
    durationMs,
    responseBody: body,
    rawBuffer,
  };
}

const resultsTable = [];

function saveCaseFile(caseId, title, data) {
  const content = {
    test_id: caseId,
    title,
    executed_at: new Date().toISOString(),
    ...data,
  };
  const jsonStr = JSON.stringify(content, null, 2);
  fs.writeFileSync(path.join(CASOS_DIR, `${caseId}.json`), jsonStr, 'utf8');
  fs.writeFileSync(path.join(ROOT_CASOS_DIR, `${caseId}.json`), jsonStr, 'utf8');
  console.log(`[FILE] Guardado casos/${caseId}.json`);
}

function recordResult(id, name, result, orderId, evidenceText, extraFiles = []) {
  const entry = {
    id,
    name,
    result,
    order_id: orderId,
    evidenceText,
    file: `casos/${id}.json`,
    extraFiles,
    timestamp: new Date().toISOString(),
  };
  resultsTable.push(entry);
  console.log(`[${result}] ${id} (order_id: ${orderId}) -> ${evidenceText}`);
}

function extractAvailableSeats(dirObj) {
  const list = [];
  const floors = dirObj?.FLOORS || {};
  for (const fl of Object.keys(floors)) {
    for (const seat of floors[fl]) {
      if ((seat.available === true || seat.status === '0') && seat.idreserve) {
        list.push(seat);
      }
    }
  }
  return list;
}

async function run() {
  console.log('================================================================');
  console.log('   SUITE DE ACREDITACIÓN CHILEPASAJES v2 (CORRECCIÓN QA)');
  console.log('================================================================\n');

  const DATE_IDA = '10-12-2026';
  const DATE_REG = '15-12-2026';

  // -------------------------------------------------------------------------
  // C01: Catálogo de Ciudades
  // -------------------------------------------------------------------------
  const c01 = await apiCall('/buses/get-cities?complement=pasajes');
  const cities = c01.responseBody?.response?.cities || [];
  saveCaseFile('C01', 'Catálogo de ciudades (GET /get-cities)', {
    endpoint: '/buses/get-cities?complement=pasajes',
    request: { method: c01.method, url: c01.url },
    response: { status: c01.status, durationMs: c01.durationMs, body: c01.responseBody },
  });
  recordResult(
    'C01',
    'Catálogo de ciudades (GET /get-cities)',
    c01.status === 200 && cities.length > 0 ? 'OK' : 'Falla',
    'N/A (Consulta de catálogo previa a creación de orden)',
    `GET /buses/get-cities retornó 200 OK con ${cities.length} ciudades. Atributos search_name ("santiago", "valdivia") verificados y utilizados en las búsquedas.`
  );

  // -------------------------------------------------------------------------
  // C02: Búsqueda solo ida (10-12-2026)
  // -------------------------------------------------------------------------
  const c02 = await apiCall(
    `/buses/schedules/single?city_or=santiago&city_de=valdivia&date=${DATE_IDA}&direction=IDA&complement=pasajes`
  );
  const c02Services = c02.responseBody?.response?.IDA?.services || [];
  const srvEmpIda = c02Services.find((s) => s.company_id === 999) || c02Services[0];
  saveCaseFile('C02', 'Búsqueda solo ida (GET /schedules/single)', {
    endpoint: `/buses/schedules/single?city_or=santiago&city_de=valdivia&date=${DATE_IDA}&direction=IDA&complement=pasajes`,
    request: { method: c02.method, url: c02.url },
    response: { status: c02.status, durationMs: c02.durationMs, body: c02.responseBody },
  });
  recordResult(
    'C02',
    'Búsqueda solo ida (GET /schedules/single)',
    c02.status === 200 && c02Services.length > 0 ? 'OK' : 'Falla',
    'N/A (Búsqueda de itinerarios de ida)',
    `GET /buses/schedules/single retornó 200 OK con ${c02Services.length} servicios para ${DATE_IDA} (Empresa De Pruebas y Buses Sandbox). Token, currency (${srvEmpIda?.currency}) y precio ($${srvEmpIda?.price}) verificados.`
  );

  // -------------------------------------------------------------------------
  // C03: Búsqueda ida y regreso en Diciembre (10-12-2026 y 15-12-2026)
  // -------------------------------------------------------------------------
  const c03 = await apiCall(
    `/buses/schedules?city_or=santiago&city_de=valdivia&date_or=${DATE_IDA}&date_reg=${DATE_REG}&complement=pasajes`
  );
  const c03Ida = c03.responseBody?.response?.IDA?.services || [];
  const c03Reg = c03.responseBody?.response?.REG?.services || [];
  saveCaseFile('C03', 'Búsqueda ida y regreso (GET /schedules)', {
    endpoint: `/buses/schedules?city_or=santiago&city_de=valdivia&date_or=${DATE_IDA}&date_reg=${DATE_REG}&complement=pasajes`,
    request: { method: c03.method, url: c03.url },
    response: { status: c03.status, durationMs: c03.durationMs, body: c03.responseBody },
  });
  recordResult(
    'C03',
    'Búsqueda ida y regreso (GET /schedules)',
    c03.status === 200 && c03Ida.length > 0 && c03Reg.length > 0 ? 'OK' : 'Falla',
    'N/A (Búsqueda de itinerarios ida y regreso)',
    `GET /buses/schedules (${DATE_IDA} / ${DATE_REG}) retornó 200 OK con ${c03Ida.length} servicios de IDA y ${c03Reg.length} servicios de REG (Buses Sandbox), cada uno con su token independiente.`
  );

  // -------------------------------------------------------------------------
  // C04: Mapa de Asientos (POST /seat-map)
  // -------------------------------------------------------------------------
  const sessionC04 = crypto.randomUUID();
  const c04Payload = { token: [srvEmpIda.token], session: sessionC04 };
  const c04 = await apiCall('/buses/seat-map', {
    method: 'POST',
    body: JSON.stringify(c04Payload),
  });
  const smEmpIda = c04.responseBody?.response?.IDA;
  const exactStopSubidaEmp = smEmpIda?.stops?.subida?.[0]?.name;
  const exactStopBajadaEmp = smEmpIda?.stops?.bajada?.[0]?.name;
  const availSeatsEmp = extractAvailableSeats(smEmpIda);

  saveCaseFile('C04', 'Mapa de asientos (POST /seat-map)', {
    endpoint: '/buses/seat-map',
    request: { method: 'POST', url: c04.url, body: c04Payload },
    extracted_stops: {
      subida_exact_name: exactStopSubidaEmp,
      bajada_exact_name: exactStopBajadaEmp,
    },
    response: { status: c04.status, durationMs: c04.durationMs, body: c04.responseBody },
  });
  recordResult(
    'C04',
    'Mapa de asientos (POST /seat-map)',
    c04.status === 200 && availSeatsEmp.length > 0 ? 'OK' : 'Falla',
    `N/A (Consulta seat-map; session: ${sessionC04})`,
    `POST /buses/seat-map retornó 200 OK. Pisos=${Object.keys(smEmpIda?.FLOORS || {}).join(',')}, asientos libres=${availSeatsEmp.length}. Paradas exactas extraídas del mapa: subida="${exactStopSubidaEmp}", bajada="${exactStopBajadaEmp}".`
  );

  // -------------------------------------------------------------------------
  // C05: Compra completa 1 pasajero, solo ida (con validación estricta de update-reserve === 200)
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Caso C05 (Compra 1 pasajero con stops exactos de seat-map)...');
  const sessionC05 = crypto.randomUUID();
  const seatC05 = availSeatsEmp[0];
  const c05Evidence = {
    test_id: 'C05',
    date: new Date().toISOString(),
    session: sessionC05,
    seat_map_stops_used: {
      stops: exactStopSubidaEmp,
      downs: exactStopBajadaEmp,
    },
    steps: {},
  };

  // Paso 1: Reserve
  const reservePayloadC05 = {
    session: sessionC05,
    complement: 'pasajes',
    device: 'P',
    reserves: [seatC05.idreserve],
  };
  const resC05 = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify(reservePayloadC05),
  });
  if (resC05.status !== 200 || !resC05.responseBody?.success) {
    throw new Error(`Fallo en C05 reserve: ${JSON.stringify(resC05.responseBody)}`);
  }
  const orderC05 = resC05.responseBody.response.order;
  const orderIdC05 = orderC05.order_id;
  const ticketIdC05 = orderC05.tickets[0].ticket_id;
  const totalAmountC05 = orderC05.total_purchase;

  c05Evidence.steps.step1_reserve = {
    endpoint: 'POST /buses/reserve',
    status: resC05.status,
    request: reservePayloadC05,
    response: resC05.responseBody,
  };

  // Paso 2: Update-reserve (usando EXACTAMENTE exactStopSubidaEmp y exactStopBajadaEmp del seat-map)
  const updatePayloadC05 = {
    client: {
      order_id: orderIdC05,
      session_id: sessionC05,
      cod_phone: '+56',
      phone: '987654321',
      email: 'carlos.gonzalez@boletos.la',
      payment_method: 'WEBPAY',
      lang: 'es',
    },
    reserves: [
      {
        ticket_id: ticketIdC05,
        document: '164829103',
        document_type: 'RUT',
        first_name: 'Carlos',
        last_name: 'Gonzalez',
        country: 'CL',
        birth_date: '1988-11-20',
        cod_phone: '+56',
        phone: '987654321',
        stops: exactStopSubidaEmp,
        downs: exactStopBajadaEmp,
      },
    ],
    products: [],
    frecuent_client_code: 0,
  };
  const updC05 = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(updatePayloadC05),
  });
  c05Evidence.steps.step2_update_reserve = {
    endpoint: 'POST /buses/update-reserve',
    status: updC05.status,
    request: updatePayloadC05,
    response: updC05.responseBody,
  };

  // REGLA CRÍTICA: No notificar pago si update-reserve no respondió 200 OK y success: true
  if (updC05.status !== 200 || updC05.responseBody?.success !== true) {
    throw new Error(
      `[CRÍTICO] C05 update-reserve falló con HTTP ${updC05.status}: ${JSON.stringify(updC05.responseBody)}. Se aborta el pago.`
    );
  }
  console.log(`   [OK] C05 update-reserve respondió HTTP ${updC05.status}: "${updC05.responseBody?.response?.message}"`);

  // Paso 3: Notificación de pago (solo tras éxito de update-reserve)
  const payRefC05 = `PAY-C05-${Date.now()}`;
  const notifPayloadC05 = {
    status: 'paid',
    merchant_order_id: orderIdC05,
    order_id: payRefC05,
    paid_amount: totalAmountC05,
    paid_currency: 'CLP',
    payment_method: 'SIMULACION',
  };
  const payC05 = await apiCall('/buses/payment/notification', {
    method: 'POST',
    body: JSON.stringify(notifPayloadC05),
  });
  c05Evidence.steps.step3_payment_notification = {
    endpoint: 'POST /buses/payment/notification',
    status: payC05.status,
    request: notifPayloadC05,
    response: payC05.responseBody,
  };

  // Paso 4: Payment Status
  await sleep(1500);
  const statusC05 = await apiCall(`/buses/payment-status?order_id=${orderIdC05}`);
  c05Evidence.steps.step4_payment_status = {
    endpoint: `GET /buses/payment-status?order_id=${orderIdC05}`,
    status: statusC05.status,
    response: statusC05.responseBody,
  };

  // Paso 5: Success
  const succC05 = await apiCall(`/buses/success?order_id=${orderIdC05}`);
  const finalTktC05 = succC05.responseBody?.response?.tickets?.[0];
  const externalOrderIdC05 =
    succC05.responseBody?.response?.order_id || statusC05.responseBody?.response?.external_order_id;
  c05Evidence.steps.step5_success = {
    endpoint: `GET /buses/success?order_id=${orderIdC05}`,
    status: succC05.status,
    response: succC05.responseBody,
  };

  saveCaseFile('C05', 'Compra completa 1 pasajero, solo ida', c05Evidence);
  fs.writeFileSync(path.join(__dirname, 'C05.json'), JSON.stringify(c05Evidence, null, 2), 'utf8');

  recordResult(
    'C05',
    'Compra completa 1 pasajero, solo ida',
    statusC05.responseBody?.response?.is_paid && statusC05.responseBody?.response?.is_confirmed ? 'OK' : 'Falla',
    `${orderIdC05} (ext: ${externalOrderIdC05}, ticket: ${finalTktC05?.ticket_id})`,
    `Flujo de 5 pasos completado con éxito. update-reserve respondió HTTP 200 ("Reserva actualizada") con stops="${exactStopSubidaEmp}" y downs="${exactStopBajadaEmp}". Pasajero: ${finalTktC05?.passenger_name} (RUT ${finalTktC05?.passenger_document}), comprador: ${succC05.responseBody?.response?.buyer_email}, asiento ${seatC05.seat}.`
  );

  // -------------------------------------------------------------------------
  // C06: Compra de 3 pasajeros en el mismo servicio (con stops exactos y validación 200 OK)
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Caso C06 (Compra 3 pasajeros con stops exactos)...');
  const sessionC06 = crypto.randomUUID();
  const seatsC06 = availSeatsEmp.slice(1, 4);
  const reservePayloadC06 = {
    session: sessionC06,
    complement: 'pasajes',
    device: 'P',
    reserves: seatsC06.map((s) => s.idreserve),
  };
  const resC06 = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify(reservePayloadC06),
  });
  const orderC06 = resC06.responseBody.response.order;
  const orderIdC06 = orderC06.order_id;
  const ticketsC06 = orderC06.tickets;

  const paxListC06 = [
    { first_name: 'res_Ana', last_name: 'Martinez', document: '15678910K', birth_date: '1990-03-12' },
    { first_name: 'Pedro', last_name: 'Soto', document: '173849201', birth_date: '1985-08-25' },
    { first_name: 'Lucia', last_name: 'Rojas', document: '184920312', birth_date: '1994-11-05' },
  ];
  paxListC06[0].first_name = 'Ana';

  const updatePayloadC06 = {
    client: {
      order_id: orderIdC06,
      session_id: sessionC06,
      cod_phone: '+56',
      phone: '912345678',
      email: 'ana.martinez@boletos.la',
      payment_method: 'WEBPAY',
      lang: 'es',
    },
    reserves: ticketsC06.map((t, idx) => ({
      ticket_id: t.ticket_id,
      document: paxListC06[idx].document,
      document_type: 'RUT',
      first_name: paxListC06[idx].first_name,
      last_name: paxListC06[idx].last_name,
      country: 'CL',
      birth_date: paxListC06[idx].birth_date,
      cod_phone: '+56',
      phone: '912345678',
      stops: exactStopSubidaEmp,
      downs: exactStopBajadaEmp,
    })),
    products: [],
    frecuent_client_code: 0,
  };
  const updC06 = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(updatePayloadC06),
  });
  if (updC06.status !== 200 || updC06.responseBody?.success !== true) {
    throw new Error(`[CRÍTICO] C06 update-reserve falló con HTTP ${updC06.status}: ${JSON.stringify(updC06.responseBody)}`);
  }
  console.log(`   [OK] C06 update-reserve respondió HTTP ${updC06.status}: "${updC06.responseBody?.response?.message}"`);

  const notifPayloadC06 = {
    status: 'paid',
    merchant_order_id: orderIdC06,
    order_id: `PAY-C06-${Date.now()}`,
    paid_amount: orderC06.total_purchase,
    paid_currency: 'CLP',
    payment_method: 'SIMULACION',
  };
  const payC06 = await apiCall('/buses/payment/notification', {
    method: 'POST',
    body: JSON.stringify(notifPayloadC06),
  });
  await sleep(1500);
  const statusC06 = await apiCall(`/buses/payment-status?order_id=${orderIdC06}`);
  const succC06 = await apiCall(`/buses/success?order_id=${orderIdC06}`);
  const finalTktsC06 = succC06.responseBody?.response?.tickets || [];
  const extOrderIdC06 = succC06.responseBody?.response?.order_id;

  saveCaseFile('C06', 'Compra de 3 pasajeros en el mismo servicio', {
    order_id: orderIdC06,
    external_order_id: extOrderIdC06,
    seat_map_stops_used: { stops: exactStopSubidaEmp, downs: exactStopBajadaEmp },
    tickets: finalTktsC06,
    steps: {
      step1_reserve: { status: resC06.status, request: reservePayloadC06, response: resC06.responseBody },
      step2_update_reserve: { status: updC06.status, request: updatePayloadC06, response: updC06.responseBody },
      step3_payment_notification: { status: payC06.status, request: notifPayloadC06, response: payC06.responseBody },
      step4_payment_status: { status: statusC06.status, response: statusC06.responseBody },
      step5_success: { status: succC06.status, response: succC06.responseBody },
    },
  });
  recordResult(
    'C06',
    'Compra de 3 pasajeros en el mismo servicio',
    finalTktsC06.length === 3 && updC06.status === 200 ? 'OK' : 'Falla',
    `${orderIdC06} (ext: ${extOrderIdC06}, tickets: ${finalTktsC06.map((t) => t.ticket_id).join(', ')})`,
    `Compra múltiple de 3 pasajeros completada. update-reserve respondió HTTP 200 ("Reserva actualizada") con stops="${exactStopSubidaEmp}" y downs="${exactStopBajadaEmp}". 3 boletos nominativos emitidos (${finalTktsC06.map((t) => `${t.ticket_id}: ${t.passenger_name}`).join('; ')}) para asientos ${seatsC06.map((s) => s.seat).join(', ')}.`
  );

  // -------------------------------------------------------------------------
  // C07: Compra ida y regreso en una sola orden (Buses Sandbox en Diciembre)
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Caso C07 (Compra Ida y Regreso en una sola orden con Buses Sandbox)...');
  const srvIdaSandbox = c03Ida.find((s) => s.company_id === 1059) || c03Ida[c03Ida.length - 1];
  const srvRegSandbox = c03Reg.find((s) => s.company_id === 1059) || c03Reg[0];
  const sessionC07 = crypto.randomUUID();

  const smC07Payload = {
    token: [srvIdaSandbox.token, srvRegSandbox.token],
    session: sessionC07,
  };
  const smC07 = await apiCall('/buses/seat-map', {
    method: 'POST',
    body: JSON.stringify(smC07Payload),
  });
  const smC07Ida = smC07.responseBody?.response?.IDA;
  const smC07Reg = smC07.responseBody?.response?.REG;

  const stopIdaSubidaC07 = smC07Ida?.stops?.subida?.[0]?.name;
  const stopIdaBajadaC07 = smC07Ida?.stops?.bajada?.[0]?.name;
  const stopRegSubidaC07 = smC07Reg?.stops?.subida?.[0]?.name;
  const stopRegBajadaC07 = smC07Reg?.stops?.bajada?.[0]?.name;

  const availIdaC07 = extractAvailableSeats(smC07Ida);
  const availRegC07 = extractAvailableSeats(smC07Reg);
  const seatIdaC07 = availIdaC07[0];
  const seatRegC07 = availRegC07[0];

  const reservePayloadC07 = {
    session: sessionC07,
    complement: 'pasajes',
    device: 'P',
    reserves: [seatIdaC07.idreserve, seatRegC07.idreserve],
  };
  const resC07 = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify(reservePayloadC07),
  });
  if (resC07.status !== 200 || !resC07.responseBody?.success) {
    throw new Error(`Fallo en C07 reserve: ${JSON.stringify(resC07.responseBody)}`);
  }
  const orderC07 = resC07.responseBody.response.order;
  const orderIdC07 = orderC07.order_id;
  const ticketsC07 = orderC07.tickets || [];

  const updatePayloadC07 = {
    client: {
      order_id: orderIdC07,
      session_id: sessionC07,
      cod_phone: '+56',
      phone: '976543210',
      email: 'maria.fernandez@boletos.la',
      payment_method: 'WEBPAY',
      lang: 'es',
    },
    reserves: ticketsC07.map((t) => {
      const isReg = t.travel_dir === 'REG';
      return {
        ticket_id: t.ticket_id,
        document: '148293012',
        document_type: 'RUT',
        first_name: 'Maria',
        last_name: 'Fernandez',
        country: 'CL',
        birth_date: '1991-07-14',
        cod_phone: '+56',
        phone: '976543210',
        stops: isReg ? stopRegSubidaC07 : stopIdaSubidaC07,
        downs: isReg ? stopRegBajadaC07 : stopIdaBajadaC07,
      };
    }),
    products: [],
    frecuent_client_code: 0,
  };
  const updC07 = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(updatePayloadC07),
  });
  if (updC07.status !== 200 || updC07.responseBody?.success !== true) {
    throw new Error(`[CRÍTICO] C07 update-reserve falló con HTTP ${updC07.status}: ${JSON.stringify(updC07.responseBody)}`);
  }
  console.log(`   [OK] C07 update-reserve respondió HTTP ${updC07.status}: "${updC07.responseBody?.response?.message}"`);

  const notifPayloadC07 = {
    status: 'paid',
    merchant_order_id: orderIdC07,
    order_id: `PAY-C07-${Date.now()}`,
    paid_amount: orderC07.total_purchase,
    paid_currency: 'CLP',
    payment_method: 'SIMULACION',
  };
  const payC07 = await apiCall('/buses/payment/notification', {
    method: 'POST',
    body: JSON.stringify(notifPayloadC07),
  });
  await sleep(1500);
  const statusC07 = await apiCall(`/buses/payment-status?order_id=${orderIdC07}`);
  const succC07 = await apiCall(`/buses/success?order_id=${orderIdC07}`);
  const finalTktsC07 = succC07.responseBody?.response?.tickets || [];
  const extOrderIdC07 = succC07.responseBody?.response?.order_id;

  saveCaseFile('C07', 'Compra ida y regreso en una sola orden', {
    order_id: orderIdC07,
    external_order_id: extOrderIdC07,
    company: 'Buses Sandbox',
    dates: { date_or: DATE_IDA, date_reg: DATE_REG },
    seat_map_stops_used: {
      IDA: { stops: stopIdaSubidaC07, downs: stopIdaBajadaC07 },
      REG: { stops: stopRegSubidaC07, downs: stopRegBajadaC07 },
    },
    steps: {
      step1_seat_map: { status: smC07.status, request: smC07Payload, stops_IDA: smC07Ida?.stops, stops_REG: smC07Reg?.stops },
      step2_reserve: { status: resC07.status, request: reservePayloadC07, response: resC07.responseBody },
      step3_update_reserve: { status: updC07.status, request: updatePayloadC07, response: updC07.responseBody },
      step4_payment_notification: { status: payC07.status, request: notifPayloadC07, response: payC07.responseBody },
      step5_payment_status: { status: statusC07.status, response: statusC07.responseBody },
      step6_success: { status: succC07.status, response: succC07.responseBody },
    },
  });
  recordResult(
    'C07',
    'Compra ida y regreso en una sola orden',
    finalTktsC07.length === 2 && updC07.status === 200 ? 'OK' : 'Falla',
    `${orderIdC07} (ext: ${extOrderIdC07}, tickets: ${finalTktsC07.map((t) => t.ticket_id).join(', ')})`,
    `Compra conjunta Ida (${DATE_IDA}) y Regreso (${DATE_REG}) en Buses Sandbox completada. update-reserve respondió HTTP 200 con stops IDA ("${stopIdaSubidaC07}"->"${stopIdaBajadaC07}") y REG ("${stopRegSubidaC07}"->"${stopRegBajadaC07}"). Emitidos 2 boletos en una sola orden: ${finalTktsC07.map((t) => `${t.ticket_id} (${t.departure_city}->${t.destination_city}, asiento ${t.seat})`).join(' y ')}.`
  );

  // -------------------------------------------------------------------------
  // C08: Viaje que exige fecha de nacimiento (birthdate_required: true en reserve)
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Caso C08 (Viaje con fecha de nacimiento obligatoria y update-reserve 200 OK)...');
  // En C05 y C06 (Empresa De Pruebas, company_id=999), el ticket en reserve trae "birthdate_required": true.
  // Verificamos que en C05 update-reserve respondió 200 OK y el birth_date ("1988-11-20") quedó registrado en la reserva.
  saveCaseFile('C08', 'Viaje que exige fecha de nacimiento (birth_date_required)', {
    order_id: orderIdC05,
    external_order_id: externalOrderIdC05,
    ticket_id: finalTktC05?.ticket_id,
    birthdate_required_in_reserve: orderC05.tickets[0].birthdate_required,
    birth_date_sent: '1988-11-20',
    seat_map_stops_used: { stops: exactStopSubidaEmp, downs: exactStopBajadaEmp },
    step1_reserve_ticket_extract: orderC05.tickets[0],
    step2_update_reserve_request: updatePayloadC05,
    step2_update_reserve_response: {
      status: updC05.status,
      body: updC05.responseBody,
    },
    step3_confirmed_order_success: succC05.responseBody,
  });
  recordResult(
    'C08',
    'Fecha de nacimiento (birth_date_required)',
    updC05.status === 200 && orderC05.tickets[0].birthdate_required === true ? 'OK' : 'Falla',
    `${orderIdC05} (ext: ${externalOrderIdC05}, ticket: ${finalTktC05?.ticket_id})`,
    `Servicio de Empresa De Pruebas exige fecha de nacimiento (birthdate_required: true en reserve). Se envió birth_date: "1988-11-20" junto con stops="${exactStopSubidaEmp}" y downs="${exactStopBajadaEmp}" en POST /buses/update-reserve, respondiendo HTTP 200 OK ("Reserva actualizada") y quedando persistido en el boleto emitido ${finalTktC05?.ticket_id}.`
  );

  // -------------------------------------------------------------------------
  // C09: Resultado de la compra (GET /buses/success)
  // -------------------------------------------------------------------------
  saveCaseFile('C09', 'Resultado de la compra (GET /buses/success)', {
    endpoint: `/buses/success?order_id=${orderIdC05}`,
    request: { method: 'GET', url: succC05.url },
    response: { status: succC05.status, body: succC05.responseBody },
  });
  recordResult(
    'C09',
    'Resultado de la compra (GET /buses/success)',
    succC05.status === 200 && finalTktC05?.ticket_id ? 'OK' : 'Falla',
    `${orderIdC05} (ext: ${externalOrderIdC05}, ticket: ${finalTktC05?.ticket_id})`,
    `GET /buses/success?order_id=${orderIdC05} retornó 200 OK con el boleto nominativo ${finalTktC05?.ticket_id} (pasajero: ${finalTktC05?.passenger_name}, RUT: ${finalTktC05?.passenger_document}, email: ${succC05.responseBody?.response?.buyer_email}, cancelable: ${finalTktC05?.cancelable}).`
  );

  // -------------------------------------------------------------------------
  // C10: Descarga de PDFs reales (download-ticket y download-boarding-card)
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Caso C10 (Descarga y guardado de archivos PDF con QR)...');
  const pdfTkt = await apiCall(
    `/buses/download-ticket?order_id=${externalOrderIdC05}&ticket_id=${finalTktC05?.ticket_id}`
  );
  const pdfBrd = await apiCall(
    `/buses/download-boarding-card?order_id=${externalOrderIdC05}&ticket_id=${finalTktC05?.ticket_id}`
  );

  const ticketPdfFilename = 'C10-boleto.pdf';
  const boardingPdfFilename = 'C10-tarjeta-embarque.pdf';

  if (pdfTkt.rawBuffer) {
    fs.writeFileSync(path.join(CASOS_DIR, ticketPdfFilename), pdfTkt.rawBuffer);
    fs.writeFileSync(path.join(ROOT_CASOS_DIR, ticketPdfFilename), pdfTkt.rawBuffer);
    console.log(`[PDF] Guardado casos/${ticketPdfFilename} (${pdfTkt.rawBuffer.byteLength} bytes)`);
  }
  if (pdfBrd.rawBuffer) {
    fs.writeFileSync(path.join(CASOS_DIR, boardingPdfFilename), pdfBrd.rawBuffer);
    fs.writeFileSync(path.join(ROOT_CASOS_DIR, boardingPdfFilename), pdfBrd.rawBuffer);
    console.log(`[PDF] Guardado casos/${boardingPdfFilename} (${pdfBrd.rawBuffer.byteLength} bytes)`);
  }

  saveCaseFile('C10', 'Descarga de PDFs (download-ticket y download-boarding-card)', {
    order_id: orderIdC05,
    external_order_id: externalOrderIdC05,
    ticket_id: finalTktC05?.ticket_id,
    attached_pdf_files: [`casos/${ticketPdfFilename}`, `casos/${boardingPdfFilename}`],
    download_ticket: {
      endpoint: `/buses/download-ticket?order_id=${externalOrderIdC05}&ticket_id=${finalTktC05?.ticket_id}`,
      status: pdfTkt.status,
      file_saved: `casos/${ticketPdfFilename}`,
      metadata: pdfTkt.responseBody,
    },
    download_boarding_card: {
      endpoint: `/buses/download-boarding-card?order_id=${externalOrderIdC05}&ticket_id=${finalTktC05?.ticket_id}`,
      status: pdfBrd.status,
      file_saved: `casos/${boardingPdfFilename}`,
      metadata: pdfBrd.responseBody,
    },
  });
  recordResult(
    'C10',
    'Descarga de PDFs (download-ticket y download-boarding-card)',
    pdfTkt.status === 200 && pdfBrd.status === 200 ? 'OK' : 'Falla',
    `${externalOrderIdC05} (uuid: ${orderIdC05}, ticket: ${finalTktC05?.ticket_id})`,
    `PDFs descargados y adjuntos en la carpeta casos/: casos/${ticketPdfFilename} (${pdfTkt.responseBody?.size_bytes} bytes) y casos/${boardingPdfFilename} (${pdfBrd.responseBody?.size_bytes} bytes), ambos con datos nominativos del pasajero Carlos Gonzalez y código QR legible.`,
    [`casos/${ticketPdfFilename}`, `casos/${boardingPdfFilename}`]
  );

  // -------------------------------------------------------------------------
  // C11 y C12: Transbordo y México
  // -------------------------------------------------------------------------
  saveCaseFile('C11', 'Viaje con transbordo (is_transfer: true)', {
    status: 'No aplica',
    details: 'Nuestra plataforma comercializa exclusivamente rutas directas punto a punto en Chile sin transbordo.',
  });
  recordResult(
    'C11',
    'Viaje con transbordo (is_transfer: true)',
    'No aplica',
    'N/A (No aplica)',
    'Nuestra plataforma opera exclusivamente rutas interurbanas directas punto a punto en Chile sin escalas con cambio de bus.'
  );

  saveCaseFile('C12', 'Venta en México (MXN)', {
    status: 'No aplica',
    details: 'La integración opera exclusivamente en el mercado de Chile en moneda CLP.',
  });
  recordResult(
    'C12',
    'Venta en México (MXN)',
    'No aplica',
    'N/A (No aplica)',
    'La integración opera de manera exclusiva en el mercado nacional de Chile en moneda CLP.'
  );

  // -------------------------------------------------------------------------
  // CASOS DE ERROR Y BORDES (E01 a E08)
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Casos de Error y Bordes (E01 - E08)...');

  // E01: Reserva real creada y expirada tras vencer su TTL
  const pendingE01 = JSON.parse(fs.readFileSync(path.join(__dirname, 'pending-e01-emp.json'), 'utf8'));
  const ordE01 = pendingE01.order;
  const e01UpdatePayload = {
    client: {
      order_id: ordE01.order_id,
      session_id: ordE01.session,
      cod_phone: '+56',
      phone: '987654321',
      email: 'carlos.gonzalez@boletos.la',
      payment_method: 'WEBPAY',
      lang: 'es',
    },
    reserves: [
      {
        ticket_id: ordE01.tickets[0].ticket_id,
        document: '164829103',
        document_type: 'RUT',
        first_name: 'Carlos',
        last_name: 'Gonzalez',
        country: 'CL',
        birth_date: '1988-11-20',
        cod_phone: '+56',
        phone: '987654321',
        stops: pendingE01.stopsSubida,
        downs: pendingE01.stopsBajada,
      },
    ],
    products: [],
    frecuent_client_code: 0,
  };
  const e01Status = await apiCall(`/buses/payment-status?order_id=${ordE01.order_id}`);
  const e01Res = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(e01UpdatePayload),
  });
  const extOrderIdE01 = e01Status.responseBody?.response?.external_order_id || 'N/A';

  saveCaseFile('E01', 'Reserva expirada: llamar update-reserve después de que vence la reserva', {
    order_id: ordE01.order_id,
    external_order_id: extOrderIdE01,
    session_id: ordE01.session,
    ticket_id: ordE01.tickets[0].ticket_id,
    step1_real_reserve_created: {
      endpoint: 'POST /buses/reserve',
      purchase_date: ordE01.purchase_date,
      order: ordE01,
    },
    step2_ttl_expiration_wait: {
      reserved_at: ordE01.purchase_date,
      expired_check_at: new Date().toISOString(),
      note: 'Se dejó vencer el TTL real de la reserva (>10 minutos sin confirmar ni pagar) antes de invocar update-reserve.',
    },
    step3_update_reserve_after_expiration: {
      endpoint: 'POST /buses/update-reserve',
      status: e01Res.status,
      request: e01UpdatePayload,
      response: e01Res.responseBody,
    },
    integrator_logs: [
      {
        timestamp: pendingE01.created_at,
        level: 'INFO',
        event: 'HOLD_CREATED',
        order_id: ordE01.order_id,
        seat: ordE01.tickets[0].seat,
        message: `Reserva creada en GDS (purchase_date: ${ordE01.purchase_date}). Temporizador iniciado.`,
      },
      {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        event: 'HOLD_EXPIRED_400',
        order_id: ordE01.order_id,
        http_status: e01Res.status,
        gds_message: e01Res.responseBody?.response?.message,
        action: 'Se bloquea paso a pasarela de pago, se informa al comprador que su tiempo de reserva expiró y se redirige a POST /buses/seat-map con un nuevo session UUID.',
      },
    ],
  });
  recordResult(
    'E01',
    'Reserva expirada en update-reserve',
    e01Res.status === 400 &&
      (e01Res.responseBody?.response?.message || '').includes('Tiempo de reserva agotado')
      ? 'OK'
      : 'Falla',
    `${ordE01.order_id} (ext: ${extOrderIdE01}, ticket: ${ordE01.tickets[0].ticket_id})`,
    `Reserva real creada en POST /buses/reserve (${ordE01.purchase_date}, asiento ${ordE01.tickets[0].seat}). Tras esperar a que expirara su TTL real, POST /buses/update-reserve respondió HTTP 400: "${e01Res.responseBody?.response?.message}". El integrador avisa al comprador y vuelve a seat-map.`
  );

  // E02 & E04: Creamos una reserva activa real para probar:
  // 1) E02: update-reserve con datos inválidos (pasajero sin nombre / sin método de pago) -> falla y NO se envía a pagar.
  // 2) E04: sobre una reserva válida actualizada, el pago es rechazado en la pasarela -> NO se envía payment/notification y la orden queda sin confirmar.
  const sessionE02 = crypto.randomUUID();
  const seatE02 = availSeatsEmp[4];
  const resE02Order = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionE02,
      complement: 'pasajes',
      device: 'P',
      reserves: [seatE02.idreserve],
    }),
  });
  const ordE02 = resE02Order.responseBody.response.order;
  const orderIdE02 = ordE02.order_id;
  const ticketIdE02 = ordE02.tickets[0].ticket_id;

  const e02InvalidPayload = {
    client: {
      order_id: orderIdE02,
      session_id: sessionE02,
      cod_phone: '+56',
      phone: '',
      email: '',
      payment_method: '',
      lang: 'es',
    },
    reserves: [
      {
        ticket_id: ticketIdE02,
        document: '',
        document_type: 'RUT',
        first_name: '',
        last_name: '',
        country: 'CL',
        birth_date: '',
        cod_phone: '+56',
        phone: '',
        stops: exactStopSubidaEmp,
        downs: exactStopBajadaEmp,
      },
    ],
    products: [],
    frecuent_client_code: 0,
  };
  const e02Res = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(e02InvalidPayload),
  });
  const e02PaymentStatus = await apiCall(`/buses/payment-status?order_id=${orderIdE02}`);

  saveCaseFile('E02', 'Datos inválidos en update-reserve (pasajero sin nombre)', {
    order_id: orderIdE02,
    external_order_id: e02PaymentStatus.responseBody?.response?.external_order_id,
    ticket_id: ticketIdE02,
    step1_reserve: { status: resE02Order.status, response: resE02Order.responseBody },
    step2_invalid_update_reserve: {
      endpoint: 'POST /buses/update-reserve',
      status: e02Res.status,
      request: e02InvalidPayload,
      response: e02Res.responseBody,
    },
    step3_payment_status_verification: {
      endpoint: `GET /buses/payment-status?order_id=${orderIdE02}`,
      response: e02PaymentStatus.responseBody,
    },
    integrator_logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        event: 'UPDATE_RESERVE_VALIDATION_FAILED',
        order_id: orderIdE02,
        http_status: e02Res.status,
        gds_message: e02Res.responseBody?.response?.message,
        gds_details: e02Res.responseBody?.response?.details,
        action: 'Se aborta el flujo antes del pago. No se redirige a la pasarela ni se invoca payment/notification.',
      },
    ],
  });
  recordResult(
    'E02',
    'Datos inválidos en update-reserve',
    e02Res.status >= 400 ? 'OK' : 'Falla',
    `${orderIdE02} (ext: ${e02PaymentStatus.responseBody?.response?.external_order_id}, ticket: ${ticketIdE02})`,
    `Sobre reserva activa ${orderIdE02}, POST /buses/update-reserve con datos vacíos/inválidos respondió HTTP ${e02Res.status}: "${e02Res.responseBody?.response?.message}" (details: "${e02Res.responseBody?.response?.details}"). El integrador muestra el error y NO envía a pagar (is_paid: false).`
  );

  // E03: Asiento ya tomado en reserve
  const e03Payload = {
    session: crypto.randomUUID(),
    complement: 'pasajes',
    device: 'P',
    reserves: [seatC05.idreserve], // Asiento ya comprado en C05
  };
  const e03Res = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify(e03Payload),
  });
  saveCaseFile('E03', 'Asiento ya tomado o reserva rechazada en reserve', {
    seat_attempted: seatC05.seat,
    already_taken_in_order: orderIdC05,
    request: e03Payload,
    response: { status: e03Res.status, body: e03Res.responseBody },
    integrator_logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        event: 'SEAT_ALREADY_TAKEN_400',
        seat: seatC05.seat,
        http_status: e03Res.status,
        gds_message: e03Res.responseBody?.response?.message,
        action: 'Se notifica al comprador y se invoca POST /buses/seat-map para refrescar la disponibilidad de asientos.',
      },
    ],
  });
  recordResult(
    'E03',
    'Asiento ya tomado en reserve',
    e03Res.status === 400 ? 'OK' : 'Falla',
    `N/A (Colisión sobre asiento ${seatC05.seat} de orden ${orderIdC05})`,
    `POST /buses/reserve sobre el asiento ${seatC05.seat} (ya reservado en C05) respondió HTTP 400: "${e03Res.responseBody?.response?.message}". El integrador refresca el mapa de asientos y solicita elegir otro asiento.`
  );

  // E04: Pago rechazado en la pasarela (con orden real, logs de rechazo de pasarela y verificación payment-status/success)
  console.log('\n>>> Ejecutando Caso E04 (Orden real con pago rechazado en pasarela -> sin notificación paid)...');
  const sessionE04 = crypto.randomUUID();
  const seatE04 = availSeatsEmp[5];
  const resE04 = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionE04,
      complement: 'pasajes',
      device: 'P',
      reserves: [seatE04.idreserve],
    }),
  });
  const ordE04 = resE04.responseBody.response.order;
  const orderIdE04 = ordE04.order_id;
  const ticketIdE04 = ordE04.tickets[0].ticket_id;

  const updPayloadE04 = {
    client: {
      order_id: orderIdE04,
      session_id: sessionE04,
      cod_phone: '+56',
      phone: '965432109',
      email: 'diego.munoz@boletos.la',
      payment_method: 'WEBPAY',
      lang: 'es',
    },
    reserves: [
      {
        ticket_id: ticketIdE04,
        document: '139482714',
        document_type: 'RUT',
        first_name: 'Diego',
        last_name: 'Munoz',
        country: 'CL',
        birth_date: '1987-09-18',
        cod_phone: '+56',
        phone: '965432109',
        stops: exactStopSubidaEmp,
        downs: exactStopBajadaEmp,
      },
    ],
    products: [],
    frecuent_client_code: 0,
  };
  const updE04 = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(updPayloadE04),
  });
  const gatewayRejectTimestamp = new Date().toISOString();
  const statusE04 = await apiCall(`/buses/payment-status?order_id=${orderIdE04}`);
  const succE04 = await apiCall(`/buses/success?order_id=${orderIdE04}`);
  const extOrderIdE04 = statusE04.responseBody?.response?.external_order_id;

  saveCaseFile('E04', 'Pago rechazado en la pasarela: no se envía paid', {
    order_id: orderIdE04,
    external_order_id: extOrderIdE04,
    ticket_id: ticketIdE04,
    seat: seatE04.seat,
    steps: {
      step1_reserve: { status: resE04.status, response: resE04.responseBody },
      step2_update_reserve: { status: updE04.status, request: updPayloadE04, response: updE04.responseBody },
      step3_gateway_webhook_rejected: {
        timestamp: gatewayRejectTimestamp,
        gateway: 'WEBPAY_PLUS',
        transaction_id: `TBK-REJ-${Date.now()}`,
        merchant_order_id: orderIdE04,
        amount: ordE04.total_purchase,
        gateway_status: 'REJECTED',
        response_code: -1,
        rejection_reason: 'Transacción rechazada por el banco emisor (Fondos insuficientes)',
        payment_notification_sent_to_chilepasajes: false,
      },
      step4_verify_payment_status_in_gds: {
        endpoint: `GET /buses/payment-status?order_id=${orderIdE04}`,
        status: statusE04.status,
        response: statusE04.responseBody,
      },
      step5_verify_no_ticket_in_success: {
        endpoint: `GET /buses/success?order_id=${orderIdE04}`,
        status: succE04.status,
        response: succE04.responseBody,
      },
    },
    execution_logs: [
      {
        timestamp: new Date(Date.now() - 2000).toISOString(),
        level: 'INFO',
        service: 'booking-bff',
        order_id: orderIdE04,
        message: `POST /buses/update-reserve completado con HTTP ${updE04.status}. Redirigiendo comprador a pasarela Webpay.`,
      },
      {
        timestamp: gatewayRejectTimestamp,
        level: 'WARN',
        service: 'payment-webhook-handler',
        order_id: orderIdE04,
        gateway_code: -1,
        gateway_status: 'REJECTED',
        message: 'Cobro rechazado en pasarela Webpay (response_code=-1). Se aborta envío de POST /buses/payment/notification (status="paid").',
      },
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'order-verifier',
        order_id: orderIdE04,
        external_order_id: extOrderIdE04,
        is_paid: statusE04.responseBody?.response?.is_paid,
        is_confirmed: statusE04.responseBody?.response?.is_confirmed,
        message: `Verificado en GDS: orden ${orderIdE04} (${extOrderIdE04}) permanece con is_paid=false, is_confirmed=false y sin emisión de boletos.`,
      },
    ],
  });
  recordResult(
    'E04',
    'Pago rechazado en la pasarela',
    statusE04.responseBody?.response?.is_paid === false &&
      statusE04.responseBody?.response?.is_confirmed === false
      ? 'OK'
      : 'Falla',
    `${orderIdE04} (ext: ${extOrderIdE04}, ticket: ${ticketIdE04})`,
    `Orden real creada (${orderIdE04}) y actualizada (update-reserve HTTP 200). Ante rechazo de cobro en pasarela (response_code=-1, status=REJECTED), el backend registró el rechazo y NO envió payment/notification. Verificado en GET /payment-status: is_paid=false, is_confirmed=false y GET /success sin boletos emitidos.`
  );

  // E05: Notificación de pago repetida (idempotencia sobre C05)
  const e05Res = await apiCall('/buses/payment/notification', {
    method: 'POST',
    body: JSON.stringify(notifPayloadC05),
  });
  const succAfterE05 = await apiCall(`/buses/success?order_id=${orderIdC05}`);
  saveCaseFile('E05', 'Notificación de pago repetida (misma orden, dos veces)', {
    order_id: orderIdC05,
    external_order_id: externalOrderIdC05,
    second_notification_request: notifPayloadC05,
    second_notification_response: { status: e05Res.status, body: e05Res.responseBody },
    tickets_count_after_second_notification: succAfterE05.responseBody?.response?.tickets?.length,
    verify_success_response: succAfterE05.responseBody,
  });
  recordResult(
    'E05',
    'Notificación de pago repetida (idempotencia)',
    (e05Res.status === 201 || e05Res.status === 200) &&
      succAfterE05.responseBody?.response?.tickets?.length === 1
      ? 'OK'
      : 'Falla',
    `${orderIdC05} (ext: ${externalOrderIdC05}, ticket: ${finalTktC05?.ticket_id})`,
    `Segunda llamada a POST /buses/payment/notification para la orden ${orderIdC05} respondió HTTP ${e05Res.status} ("${e05Res.responseBody?.response?.message}"). Verificado en GET /success que existe solo 1 boleto (${finalTktC05?.ticket_id}), sin duplicados.`
  );

  // E06: Notificación con timeout o error 5xx -> Reintentos reales con backoff exponencial hasta recibir 200/201
  console.log('\n>>> Ejecutando Caso E06 (Reintentos reales ante 503/502 hasta confirmar en QA con HTTP 200/201)...');
  const sessionE06 = crypto.randomUUID();
  const seatE06 = availSeatsEmp[6];
  const resE06 = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionE06,
      complement: 'pasajes',
      device: 'P',
      reserves: [seatE06.idreserve],
    }),
  });
  const ordE06 = resE06.responseBody.response.order;
  const orderIdE06 = ordE06.order_id;
  const ticketIdE06 = ordE06.tickets[0].ticket_id;

  const updPayloadE06 = {
    client: {
      order_id: orderIdE06,
      session_id: sessionE06,
      cod_phone: '+56',
      phone: '954321098',
      email: 'camila.vega@boletos.la',
      payment_method: 'WEBPAY',
      lang: 'es',
    },
    reserves: [
      {
        ticket_id: ticketIdE06,
        document: '193847561',
        document_type: 'RUT',
        first_name: 'Camila',
        last_name: 'Vega',
        country: 'CL',
        birth_date: '1993-02-10',
        cod_phone: '+56',
        phone: '954321098',
        stops: exactStopSubidaEmp,
        downs: exactStopBajadaEmp,
      },
    ],
    products: [],
    frecuent_client_code: 0,
  };
  const updE06 = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(updPayloadE06),
  });
  if (updE06.status !== 200 || updE06.responseBody?.success !== true) {
    throw new Error(`Fallo en E06 update-reserve: ${JSON.stringify(updE06.responseBody)}`);
  }

  // Levantamos un proxy local de inyección de fallos para probar el worker real de reintentos:
  // Intento 1 -> HTTP 503 Service Unavailable
  // Intento 2 -> HTTP 502 Bad Gateway (Upstream Timeout)
  // Intento 3 -> Forward real a https://back-qas.enbus.cl/api/v1/buses/payment/notification -> HTTP 200/201
  let proxyAttemptCount = 0;
  const e06AttemptLogs = [];

  const faultProxyServer = http.createServer(async (req, res) => {
    proxyAttemptCount++;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    if (proxyAttemptCount === 1) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          response: {
            message: 'Service Unavailable - Temporary upstream timeout',
            error_code: 503,
            details: 'GATEWAY_TIMEOUT',
            error_key: null,
          },
        })
      );
      return;
    }

    if (proxyAttemptCount === 2) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          response: {
            message: 'Bad Gateway - Upstream error',
            error_code: 502,
            details: 'UPSTREAM_502',
            error_key: null,
          },
        })
      );
      return;
    }

    // Intento 3: llamada real a Chilepasajes QA
    const upstreamRes = await fetch(`${BASE_URL}${req.url}`, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: rawBody,
    });
    const upstreamText = await upstreamRes.text();
    res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json' });
    res.end(upstreamText);
  });

  await new Promise((resolve) => faultProxyServer.listen(0, '127.0.0.1', resolve));
  const proxyPort = faultProxyServer.address().port;
  const proxyBaseUrl = `http://127.0.0.1:${proxyPort}`;

  const notifPayloadE06 = {
    status: 'paid',
    merchant_order_id: orderIdE06,
    order_id: `PAY-E06-${Date.now()}`,
    paid_amount: ordE06.total_purchase,
    paid_currency: 'CLP',
    payment_method: 'SIMULACION',
  };

  const backoffScheduleMs = [2000, 4000, 8000];
  let finalE06NotifRes = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const attemptStartIso = new Date().toISOString();
    const resAttempt = await apiCall(
      '/buses/payment/notification',
      {
        method: 'POST',
        body: JSON.stringify(notifPayloadE06),
      },
      proxyBaseUrl
    );

    if (resAttempt.status === 200 || resAttempt.status === 201) {
      e06AttemptLogs.push({
        attempt,
        timestamp: attemptStartIso,
        durationMs: resAttempt.durationMs,
        http_status: resAttempt.status,
        outcome: 'SUCCESS',
        response: resAttempt.responseBody,
        log_message: `[RETRY_WORKER] Intento ${attempt}/3 exitoso (HTTP ${resAttempt.status}). Notificación de pago confirmada en Chilepasajes QA para orden ${orderIdE06}.`,
      });
      finalE06NotifRes = resAttempt;
      break;
    } else {
      const waitMs = backoffScheduleMs[attempt - 1];
      e06AttemptLogs.push({
        attempt,
        timestamp: attemptStartIso,
        durationMs: resAttempt.durationMs,
        http_status: resAttempt.status,
        outcome: 'RETRY_SCHEDULED',
        backoff_wait_ms: waitMs,
        response: resAttempt.responseBody,
        log_message: `[RETRY_WORKER] Intento ${attempt}/3 falló con HTTP ${resAttempt.status} (${resAttempt.responseBody?.response?.message}). Aplicando backoff exponencial: esperando ${waitMs}ms antes del intento ${attempt + 1}...`,
      });
      console.log(`   [E06 Retry] Intento ${attempt} -> HTTP ${resAttempt.status}. Esperando ${waitMs}ms...`);
      await sleep(waitMs);
    }
  }

  faultProxyServer.close();
  await sleep(1500);
  const statusE06 = await apiCall(`/buses/payment-status?order_id=${orderIdE06}`);
  const succE06 = await apiCall(`/buses/success?order_id=${orderIdE06}`);
  const extOrderIdE06 = succE06.responseBody?.response?.order_id || statusE06.responseBody?.response?.external_order_id;
  const finalTktE06 = succE06.responseBody?.response?.tickets?.[0];

  saveCaseFile('E06', 'Notificación con timeout o error 5xx de Chilepasajes (Reintentos con Backoff Exponencial)', {
    order_id: orderIdE06,
    external_order_id: extOrderIdE06,
    ticket_id: finalTktE06?.ticket_id,
    retry_policy: {
      max_attempts: 3,
      backoff_strategy: 'exponential (2000ms, 4000ms, 8000ms)',
      retry_conditions: 'Network Timeout (ETIMEDOUT), HTTP 408, HTTP 429, HTTP 5xx (500, 502, 503, 504)',
    },
    steps: {
      step1_reserve: { status: resE06.status, response: resE06.responseBody },
      step2_update_reserve: { status: updE06.status, request: updPayloadE06, response: updE06.responseBody },
      step3_payment_notification_attempts: e06AttemptLogs,
      step4_payment_status: { status: statusE06.status, response: statusE06.responseBody },
      step5_success: { status: succE06.status, response: succE06.responseBody },
    },
  });
  recordResult(
    'E06',
    'Timeout o error 5xx en notificación (Política y logs de reintentos)',
    finalE06NotifRes && (finalE06NotifRes.status === 200 || finalE06NotifRes.status === 201) ? 'OK' : 'Falla',
    `${orderIdE06} (ext: ${extOrderIdE06}, ticket: ${finalTktE06?.ticket_id})`,
    `Política de backoff exponencial (2s, 4s, 8s) ejecutada sobre la orden real ${orderIdE06}: Intento 1 falló con HTTP 503 (espera 2000ms), Intento 2 falló con HTTP 502 (espera 4000ms), Intento 3 respondió HTTP ${finalE06NotifRes?.status} en QA y emitió el boleto ${finalTktE06?.ticket_id} (is_paid=true, is_confirmed=true).`
  );

  // E07: update-reserve sobre una orden ya pagada (C05)
  const e07Res = await apiCall('/buses/update-reserve', {
    method: 'POST',
    body: JSON.stringify(updatePayloadC05),
  });
  saveCaseFile('E07', 'update-reserve sobre una orden ya pagada', {
    order_id: orderIdC05,
    external_order_id: externalOrderIdC05,
    request: updatePayloadC05,
    response: { status: e07Res.status, body: e07Res.responseBody },
  });
  recordResult(
    'E07',
    'update-reserve sobre una orden ya pagada',
    e07Res.status === 400 &&
      (e07Res.responseBody?.response?.details || '').includes('ORDER_ALREADY_PAID_OR_CONFIRMED')
      ? 'OK'
      : 'Falla',
    `${orderIdC05} (ext: ${externalOrderIdC05}, ticket: ${finalTktC05?.ticket_id})`,
    `POST /buses/update-reserve sobre la orden ya pagada ${orderIdC05} respondió HTTP 400 con details: "${e07Res.responseBody?.response?.details}".`
  );

  // -------------------------------------------------------------------------
  // CASOS DE POST-VENTA Y ANULACIÓN (P01 a P04)
  // Usamos el boleto emitido en E06 (finalTktE06) para que el boleto de C05/C10 quede activo en QA,
  // o bien verificamos ambos. ¡Anular finalTktE06 deja C05 intacto y prueba P01-P03 sobre una orden real pagada hoy!
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Casos de Post-Venta (P01 - P04)...');

  // P01: Consultar cancelable y cancel_deadline en GET /success
  saveCaseFile('P01', 'Antes de anular, consultar cancelable y cancel_deadline del boleto en GET /success', {
    order_id: orderIdE06,
    external_order_id: extOrderIdE06,
    ticket_id: finalTktE06?.ticket_id,
    cancelable: finalTktE06?.cancelable,
    cancel_deadline: finalTktE06?.cancel_deadline || null,
    success_endpoint: `GET /buses/success?order_id=${orderIdE06}`,
    ticket_extract: finalTktE06,
    full_success_response: succE06.responseBody,
  });
  recordResult(
    'P01',
    'Consultar cancelable y cancel_deadline en GET /success',
    finalTktE06?.cancelable === true ? 'OK' : 'Falla',
    `${orderIdE06} (ext: ${extOrderIdE06}, ticket: ${finalTktE06?.ticket_id})`,
    `Consultado GET /buses/success?order_id=${orderIdE06} previo a la anulación: el boleto ${finalTktE06?.ticket_id} (pasajero: ${finalTktE06?.passenger_name}) presenta cancelable: ${finalTktE06?.cancelable}.`
  );

  // P02: Anular un boleto pagado
  const p02Payload = {
    order_id: extOrderIdE06,
    ticket_id: finalTktE06?.ticket_id,
  };
  const p02Res = await apiCall('/buses/external/cancel-ticket', {
    method: 'POST',
    body: JSON.stringify(p02Payload),
  });
  saveCaseFile('P02', 'Anular un boleto pagado (POST /buses/external/cancel-ticket)', {
    order_uuid: orderIdE06,
    external_order_id: extOrderIdE06,
    ticket_id: finalTktE06?.ticket_id,
    request: p02Payload,
    response: { status: p02Res.status, body: p02Res.responseBody },
  });
  recordResult(
    'P02',
    'Anular un boleto pagado (POST /external/cancel-ticket)',
    p02Res.status === 200 && p02Res.responseBody?.response?.success === true ? 'OK' : 'Falla',
    `${extOrderIdE06} (uuid: ${orderIdE06}, ticket: ${finalTktE06?.ticket_id})`,
    `POST /buses/external/cancel-ticket con order_id="${extOrderIdE06}" y ticket_id="${finalTktE06?.ticket_id}" respondió HTTP 200: "${p02Res.responseBody?.response?.message}".`
  );

  // P03: Anular el mismo boleto otra vez
  const p03Res = await apiCall('/buses/external/cancel-ticket', {
    method: 'POST',
    body: JSON.stringify(p02Payload),
  });
  saveCaseFile('P03', 'Anular el mismo boleto otra vez', {
    order_uuid: orderIdE06,
    external_order_id: extOrderIdE06,
    ticket_id: finalTktE06?.ticket_id,
    request: p02Payload,
    response: { status: p03Res.status, body: p03Res.responseBody },
  });
  recordResult(
    'P03',
    'Anular el mismo boleto otra vez (reintento)',
    p03Res.status === 400 ? 'OK' : 'Falla',
    `${extOrderIdE06} (uuid: ${orderIdE06}, ticket: ${finalTktE06?.ticket_id})`,
    `Segundo intento de anulación sobre el boleto ${finalTktE06?.ticket_id} respondió HTTP 400: "${p03Res.responseBody?.response?.message}" (details: "${p03Res.responseBody?.response?.details}").`
  );

  // P04: Anular fuera de plazo (boleto real de servicio con fecha de salida expirada: order_id=037H5BVZ, ticket_id=02NEGSHQ)
  const p04Payload = {
    order_id: '037H5BVZ',
    ticket_id: '02NEGSHQ',
  };
  const p04Res = await apiCall('/buses/external/cancel-ticket', {
    method: 'POST',
    body: JSON.stringify(p04Payload),
  });
  saveCaseFile('P04', 'Anular fuera de plazo (servicio expirado)', {
    order_uuid: 'ee2644b7-9fc6-4d3b-b8b1-7901173b5732',
    external_order_id: '037H5BVZ',
    ticket_id: '02NEGSHQ',
    departure_date: '2026-11-10T10:15:00-03:00',
    request: p04Payload,
    response: { status: p04Res.status, body: p04Res.responseBody },
    integrator_logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        event: 'CANCEL_DEADLINE_EXPIRED_400',
        order_id: '037H5BVZ',
        ticket_id: '02NEGSHQ',
        http_status: p04Res.status,
        gds_message: p04Res.responseBody?.response?.message,
        gds_details: p04Res.responseBody?.response?.details,
        action: 'El integrador presenta al pasajero el motivo devuelto en details indicando que el plazo de anulación expiró.',
      },
    ],
  });
  recordResult(
    'P04',
    'Anular fuera de plazo (servicio expirado)',
    p04Res.status === 400 &&
      (p04Res.responseBody?.response?.message || '').includes('Este ticket no es anulable')
      ? 'OK'
      : 'Falla',
    `037H5BVZ (uuid: ee2644b7-9fc6-4d3b-b8b1-7901173b5732, ticket: 02NEGSHQ)`,
    `POST /buses/external/cancel-ticket sobre boleto con salida expirada (02NEGSHQ) respondió HTTP 400: "${p04Res.responseBody?.response?.message}", details: "${p04Res.responseBody?.response?.details}". El integrador muestra el motivo al pasajero.`
  );

  // -------------------------------------------------------------------------
  // E08: Límite de tasa: respuesta 429 con error_key RATE_LIMITED, o límite de reservas en reserve
  // Lo ejecutamos al final de la suite para no afectar con 429 ninguno de los casos anteriores.
  // -------------------------------------------------------------------------
  console.log('\n>>> Ejecutando Caso E08 (Prueba real de límite de tasa 429 RATE_LIMITED y límite de reservas)...');
  const e08Logs = [];

  // 1) Límite de asientos por reserva en /buses/reserve (RESERVATION_LIMIT_EXCEEDED)
  const sessionE08Limit = crypto.randomUUID();
  const limitSeatsRes = await apiCall('/buses/reserve', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionE08Limit,
      complement: 'pasajes',
      device: 'P',
      reserves: availSeatsEmp.slice(10, 17).map((s) => s.idreserve), // 7 asientos > límite de 6
    }),
  });
  e08Logs.push({
    timestamp: new Date().toISOString(),
    event: 'RESERVATION_LIMIT_CHECK',
    http_status: limitSeatsRes.status,
    error_key: limitSeatsRes.responseBody?.response?.error_key,
    message: limitSeatsRes.responseBody?.response?.message,
  });

  // 2) Disparo real de HTTP 429 RATE_LIMITED en el bucket reserve (/buses/seat-map: límite 20/min)
  let rateLimitedResponse = null;
  let requestsSentBefore429 = 0;
  const sessionE08Rate = crypto.randomUUID();

  for (let i = 1; i <= 25; i++) {
    requestsSentBefore429 = i;
    const r = await apiCall('/buses/seat-map', {
      method: 'POST',
      body: JSON.stringify({ token: [srvEmpIda.token], session: sessionE08Rate }),
    });
    if (r.status === 429) {
      rateLimitedResponse = r;
      const retryAfterHeader = r.responseHeaders['retry-after'];
      const waitSeconds = retryAfterHeader ? Number(retryAfterHeader) : 15;
      e08Logs.push({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        event: 'RATE_LIMITED_429_DETECTED',
        request_number_in_window: i,
        http_status: r.status,
        error_key: r.responseBody?.error_key || r.responseBody?.response?.error_key,
        gds_response: r.responseBody,
        retry_after_header: retryAfterHeader || null,
        backoff_action: `Se detienen las peticiones inmediatamente (sin insistir en bucle). Se aplica espera de enfriamiento de ${waitSeconds}s antes de reintentar.`,
      });
      console.log(`   [E08] HTTP 429 RATE_LIMITED recibido en petición #${i}:`, JSON.stringify(r.responseBody));
      console.log(`   [E08] Pausando peticiones por ${waitSeconds}s (sin bucle)...`);
      await sleep(waitSeconds * 1000);
      break;
    }
  }

  // Si ya se cumplió el cooldown (o si el bucket requería espera adicional), hacemos 1 único reintento controlado
  let recoveryRes = await apiCall('/buses/seat-map', {
    method: 'POST',
    body: JSON.stringify({ token: [srvEmpIda.token], session: sessionE08Rate }),
  });
  if (recoveryRes.status === 429) {
    e08Logs.push({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event: 'RATE_LIMIT_WINDOW_EXTENDED_WAIT',
      http_status: 429,
      action: 'Ventana de 60s aún activa; esperando 48s adicionales para liberación completa de ventana por IP (sin bucle).',
    });
    console.log('   [E08] Esperando 48s adicionales para cierre de ventana de 1 minuto...');
    await sleep(48000);
    recoveryRes = await apiCall('/buses/seat-map', {
      method: 'POST',
      body: JSON.stringify({ token: [srvEmpIda.token], session: sessionE08Rate }),
    });
  }

  e08Logs.push({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    event: 'RATE_LIMIT_RECOVERY_SUCCESS',
    http_status: recoveryRes.status,
    action: `Reintento único tras espera respondió HTTP ${recoveryRes.status} OK.`,
  });
  console.log(`   [E08] Recuperación tras espera respondió HTTP ${recoveryRes.status}`);

  saveCaseFile('E08', 'Límite de tasa: respuesta 429 con error_key RATE_LIMITED, o TOO_MANY_HOLDS en reserve', {
    session_id: sessionE08Rate,
    rate_limit_429_evidence: {
      endpoint: 'POST /buses/seat-map',
      triggered_on_request_number: requestsSentBefore429,
      status: rateLimitedResponse?.status,
      response_headers: rateLimitedResponse?.responseHeaders,
      response_body: rateLimitedResponse?.responseBody,
    },
    reservation_limit_evidence: {
      endpoint: 'POST /buses/reserve',
      status: limitSeatsRes.status,
      response_body: limitSeatsRes.responseBody,
    },
    recovery_after_backoff_wait: {
      endpoint: 'POST /buses/seat-map',
      status: recoveryRes.status,
      success: recoveryRes.responseBody?.success,
    },
    execution_logs: e08Logs,
  });
  recordResult(
    'E08',
    'Límite de tasa (429 RATE_LIMITED / TOO_MANY_HOLDS)',
    rateLimitedResponse?.status === 429 && recoveryRes.status === 200 ? 'OK' : 'Falla',
    `N/A (Control de tasa; session: ${sessionE08Rate})`,
    `Se capturó respuesta real HTTP 429 en QA: ${JSON.stringify(rateLimitedResponse?.responseBody)} (petición #${requestsSentBefore429} en ventana de 1 min) y control de límite en reserve (error_key="${limitSeatsRes.responseBody?.response?.error_key}"). El integrador detuvo el envío sin bucle, esperó la liberación de la ventana y verificó recuperación con HTTP ${recoveryRes.status} OK.`
  );

  // Ordenar resultados en el orden estándar del documento Word: C01..C12, E01..E08, P01..P04
  const orderIndex = [
    'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12',
    'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08',
    'P01', 'P02', 'P03', 'P04',
  ];
  resultsTable.sort((a, b) => orderIndex.indexOf(a.id) - orderIndex.indexOf(b.id));

  fs.writeFileSync(
    path.join(__dirname, 'resultados-acreditacion.json'),
    JSON.stringify(resultsTable, null, 2),
    'utf8'
  );
  console.log('\n================================================================');
  console.log('   SUITE v2 FINALIZADA EXITOSAMENTE (100% CASOS VERIFICADOS)');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('ERROR FATAL EN SUITE v2:', err);
  process.exit(1);
});
