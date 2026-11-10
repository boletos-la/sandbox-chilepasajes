import type {
  LocationCity,
  BusService,
  Seat,
  SeatMapResponse,
  BuyerData,
  PassengerData,
  ReservationResponse,
  IssuedTicket,
  CancellationResponse,
  ApiLogEntry,
  ApiConfig,
} from "../types";

const CONFIG_STORAGE_KEY = "chilepasajes_api_config";
const TICKETS_STORAGE_KEY = "chilepasajes_local_tickets";

// Configuración GDS Oficial (Leída desde variables de entorno Next.js con fallback)
export const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: (
    process.env.NEXT_PUBLIC_CHILEPASAJES_BASE_URL ||
    "https://back-qas.enbus.cl/api/v1"
  ).trim(),
  apiKey: (
    process.env.NEXT_PUBLIC_CHILEPASAJES_API_KEY ||
    "sk_test_FtC48QXZHlbvE"
  ).trim(),
  mode: "gds_direct",
};

export const GDS_COMPLEMENT =
  process.env.NEXT_PUBLIC_CHILEPASAJES_COMPLEMENT || "pasajes";
export const GDS_DEVICE =
  process.env.NEXT_PUBLIC_CHILEPASAJES_DEVICE || "P";
export const HOLD_MINUTES =
  Number(process.env.NEXT_PUBLIC_HOLD_DURATION_MINUTES) || 15;

export function getApiConfig(): ApiConfig {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    }
  } catch (e) {
    console.error("Error al leer configuración de API:", e);
  }
  return DEFAULT_CONFIG;
}

export function saveApiConfig(config: ApiConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event("chilepasajes_config_changed"));
  }
}

// Log listener bus para el Inspector de API en tiempo real
type LogListener = (logs: ApiLogEntry[]) => void;
const logListeners: LogListener[] = [];
let apiLogs: ApiLogEntry[] = [];

export function subscribeApiLogs(listener: LogListener): () => void {
  logListeners.push(listener);
  listener([...apiLogs]);
  return () => {
    const idx = logListeners.indexOf(listener);
    if (idx >= 0) logListeners.splice(idx, 1);
  };
}

export function clearApiLogs(): void {
  apiLogs = [];
  logListeners.forEach((l) => l([]));
}

function recordLog(entry: ApiLogEntry): void {
  apiLogs = [entry, ...apiLogs].slice(0, 100);
  logListeners.forEach((l) => l([...apiLogs]));
}

// Almacenamiento local de boletos emitidos por el GDS
export function getSavedTickets(): IssuedTicket[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTicket(ticket: IssuedTicket): void {
  if (typeof window === "undefined") return;
  const current = getSavedTickets();
  const cleanCode = (ticket.ticket_code || "").trim().toUpperCase();
  const cleanId = (ticket.ticket_id || "").trim().toUpperCase();
  const cleanOrder = (ticket.order_id || "").trim().toUpperCase();

  const filtered = current.filter((t) => {
    const tCode = (t.ticket_code || "").trim().toUpperCase();
    const tId = (t.ticket_id || "").trim().toUpperCase();
    const tOrder = (t.order_id || "").trim().toUpperCase();
    if (cleanCode && tCode === cleanCode) return false;
    if (cleanId && tId === cleanId) return false;
    if (cleanOrder && tOrder === cleanOrder) return false;
    return true;
  });

  const freshTicket: IssuedTicket = {
    ...ticket,
    status: "ISSUED",
  };
  localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify([freshTicket, ...filtered]));
}

export function updateSavedTicket(ticketIdentifier: string, patch: Partial<IssuedTicket>): void {
  if (typeof window === "undefined") return;
  const current = getSavedTickets();
  const cleanId = ticketIdentifier.trim().toUpperCase();
  if (!cleanId) return;

  const updated = current.map((t) => {
    if (
      (t.ticket_code && t.ticket_code.trim().toUpperCase() === cleanId) ||
      (t.ticket_id && t.ticket_id.trim().toUpperCase() === cleanId) ||
      (t.order_id && t.order_id.trim().toUpperCase() === cleanId)
    ) {
      return { ...t, ...patch };
    }
    return t;
  });
  localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Cliente HTTP centralizado que utiliza FETCH nativo contra el GDS
 * Registra cada petición en el ApiInspector en tiempo real
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; status: number }> {
  const config = getApiConfig();
  const startTime = performance.now();

  const cleanBase = config.baseUrl.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${cleanBase}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Solo incluir Authorization si no fue omitido explícitamente (ej. payment notification)
  if (!headers["Authorization"] && !endpoint.includes("/payment/notification")) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  let responseBody: any = null;
  let status = 0;
  let statusText = "";

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
    });

    status = res.status;
    statusText = res.statusText;

    const text = await res.text();
    try {
      responseBody = text ? JSON.parse(text) : {};
    } catch {
      responseBody = { raw: text };
    }

    const durationMs = Math.round(performance.now() - startTime);

    recordLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      method: options.method || "GET",
      url: fullUrl,
      headers,
      body: options.body ? JSON.parse(options.body as string) : undefined,
      status,
      statusText,
      responseBody,
      durationMs,
      isMockFallback: false,
    });

    if (!res.ok) {
      const detailsMsg = responseBody?.response?.details || responseBody?.details;
      const mainMsg = responseBody?.response?.message || responseBody?.message;
      const errMsg =
        detailsMsg && mainMsg && typeof detailsMsg === "string" && !detailsMsg.startsWith("{")
          ? `${mainMsg} (${detailsMsg})`
          : mainMsg || `Error HTTP ${status}: ${statusText}`;

      const err = new Error(errMsg);
      (err as any).status = status;
      (err as any).response = responseBody;
      throw err;
    }

    const extracted = responseBody.response !== undefined ? responseBody.response : responseBody;
    return { data: extracted as T, status };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);

    if (status === 0) {
      // Error de red o CORS
      recordLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: options.method || "GET",
        url: fullUrl,
        headers,
        body: options.body ? JSON.parse(options.body as string) : undefined,
        status: 0,
        statusText: `Error de conexión: ${err.message}`,
        responseBody: { error: err.message },
        durationMs,
        isMockFallback: false,
      });
    }

    throw err;
  }
}

// =============================================================
// GDS CATÁLOGOS: Orígenes y Destinos Reales
// Endpoint: GET /buses/get-roads?complement=pasajes
// Endpoint: GET /buses/get-cities?complement=pasajes
// =============================================================

let cachedRoads: any[] | null = null;

export async function getLiveRoads(): Promise<any[]> {
  if (cachedRoads && cachedRoads.length > 0) return cachedRoads;
  const res = await apiFetch<any[]>(`/buses/get-roads?complement=${encodeURIComponent(GDS_COMPLEMENT)}`, { method: "GET" });
  if (Array.isArray(res.data) && res.data.length > 0) {
    cachedRoads = res.data;
    return cachedRoads;
  }
  return [];
}

export async function fetchOrigins(): Promise<LocationCity[]> {
  const roads = await getLiveRoads();
  if (!roads || roads.length === 0) {
    return [];
  }

  // Extraer ciudades de origen únicas provistas por el GDS
  const uniqueOrigins = Array.from(new Set(roads.map((r) => r.origin_city))).filter(Boolean);

  const originsList: LocationCity[] = uniqueOrigins.map((city, idx) => {
    const road = roads.find((r) => r.origin_city === city);
    return {
      id: idx + 1,
      name: city,
      search_name: city.toLowerCase(),
      region: city.toLowerCase() === "santiago" ? "Región Metropolitana" : "Chile",
      terminals: road?.terminal_origin
        ? [{ id: idx + 1, name: road.terminal_origin }]
        : [{ id: idx + 1, name: `Terminal ${city}` }],
    };
  });

  // Colocar Santiago en primer lugar si existe
  originsList.sort((a, b) => (a.name.toLowerCase() === "santiago" ? -1 : 1));
  return originsList;
}

export async function fetchDestinations(originName: string): Promise<LocationCity[]> {
  const roads = await getLiveRoads();
  if (!roads || roads.length === 0 || !originName) {
    return [];
  }

  const matchingRoads = roads.filter(
    (r) => r.origin_city.toLowerCase() === originName.toLowerCase()
  );

  const uniqueDestinations = Array.from(
    new Set(matchingRoads.map((r) => r.destination_city))
  ).filter(Boolean);

  const destinationsList: LocationCity[] = uniqueDestinations.map((dest, idx) => {
    const road = matchingRoads.find((r) => r.destination_city === dest);
    return {
      id: 1000 + idx + 1,
      name: dest,
      search_name: dest.toLowerCase(),
      region: "Chile",
      terminals: road?.terminal_destination
        ? [{ id: idx + 1, name: road.terminal_destination }]
        : [{ id: idx + 1, name: `Terminal ${dest}` }],
    };
  });

  return destinationsList;
}

// =============================================================
// GDS FASE 2: Búsqueda de Horarios y Mapa de Asientos
// Endpoint: GET /buses/schedules
// Endpoint: POST /buses/seat-map
// =============================================================

export interface SearchServicesResult {
  services: BusService[];
  nearby_dates: Array<{ date: string; date_text: string; price: number }>;
}

export async function searchServices(
  originName: string,
  destName: string,
  departureDate: string
): Promise<SearchServicesResult> {
  // Convertir YYYY-MM-DD a DD-MM-YYYY esperado por /buses/schedules
  const parts = departureDate.split("-");
  const ddmmyyyy =
    parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : departureDate;

  const oClean = encodeURIComponent(originName.toLowerCase().trim());
  const dClean = encodeURIComponent(destName.toLowerCase().trim());

  const res = await apiFetch<any>(
    `/buses/schedules?city_or=${oClean}&city_de=${dClean}&date_or=${ddmmyyyy}&complement=${encodeURIComponent(GDS_COMPLEMENT)}`,
    { method: "GET" }
  );

  const idaObj = res.data?.IDA || res.data || {};
  const rawServices: any[] = idaObj.services || [];
  const nearbyDates: any[] = idaObj.nearby_dates || [];

  const services: BusService[] = rawServices.map((srv: any) => ({
    service_id: String(srv.service_id || srv.id),
    company_id: srv.company_id,
    operator_name: srv.company_name || srv.empresa || "Empresa de Bus",
    operator_logo: srv.company_logo,
    departure_time: srv.departs_at || `${departureDate}T${srv.departs_at_hour || "08:00"}:00-03:00`,
    departs_at_hour: srv.departs_at_hour,
    arrival_time: srv.arrives_at || `${departureDate}T${srv.arrives_at_hour || "14:00"}:00-03:00`,
    arrives_at_hour: srv.arrives_at_hour,
    origin_city: srv.city_departure || originName,
    destination_city: srv.city_arrival || destName,
    origin_terminal: srv.station_departure || `Terminal ${originName}`,
    destination_terminal: srv.station_arrival || `Terminal ${destName}`,
    duration: srv.duration,
    seat_classes: [
      {
        type: srv.seat_class || "SALON CAMA",
        price: Number(srv.price || 0),
        available_seats: Number(srv.available_seats || 0),
      },
    ],
    amenities: Array.isArray(srv.amenities)
      ? srv.amenities.map((a: any) => (typeof a === "string" ? a : a.name || a.title || "Servicio"))
      : [],
    token: srv.token,
    available_seats: Number(srv.available_seats || 0),
    price: Number(srv.price || 0),
    currency: srv.currency || "CLP",
    route_description: srv.route_description,
    is_cancellable: srv.is_cancellable,
    rating_stats: srv.rating_stats,
  }));

  return {
    services,
    nearby_dates: nearbyDates,
  };
}

export async function fetchSeatMap(
  serviceToken: string,
  sessionUuid: string
): Promise<SeatMapResponse> {
  const res = await apiFetch<any>("/buses/seat-map", {
    method: "POST",
    body: JSON.stringify({
      token: [serviceToken],
      session: sessionUuid,
    }),
  });

  const ida = res.data?.IDA || {};
  const floorsObj = ida.FLOORS || {};
  const stopsObj = ida.stops || { subida: [], bajada: [] };
  const cantFloors = Number(ida.cant_floors || Object.keys(floorsObj).length || 1);
  const limitReserve = Number(ida.limit_reserve || 6);

  const seats: Seat[] = [];

  Object.keys(floorsObj).forEach((floorKey) => {
    const floorNum = Number(floorKey) || 1;
    const floorSeats: any[] = floorsObj[floorKey] || [];

    floorSeats.forEach((st: any) => {
      seats.push({
        seat_number: String(st.seat),
        floor: floorNum,
        type: st.seat_klass || st.type || "Salón Cama",
        status: st.available ? "available" : "occupied",
        price: Number(st.price || 0),
        cell: st.cell,
        order: st.order,
        idreserve: st.idreserve,
        mov_redu: !!st.mov_redu,
        pet: !!st.pet,
      });
    });
  });

  return {
    service_id: serviceToken.slice(0, 16),
    floors: cantFloors,
    cant_floors: cantFloors,
    limit_reserve: limitReserve,
    seats,
    stops: stopsObj,
  };
}

// =============================================================
// GDS FASE 3: Reservar Asientos (Hold Temporal)
// Endpoint: POST /buses/reserve
// =============================================================

export async function createReservation(payload: {
  session: string;
  reserves: string[];
  service_id?: string;
  total_amount?: number;
}): Promise<ReservationResponse> {
  const res = await apiFetch<any>("/buses/reserve", {
    method: "POST",
    body: JSON.stringify({
      session: payload.session,
      complement: GDS_COMPLEMENT,
      device: GDS_DEVICE,
      reserves: payload.reserves,
    }),
  });

  const orderData = res.data?.order || res.data || {};
  const ticketsList = orderData.tickets || [];
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return {
    order_id: orderData.order_id,
    session: orderData.session || payload.session,
    purchase_date: orderData.purchase_date,
    total_purchase: Number(orderData.total_purchase || payload.total_amount || 0),
    tickets: ticketsList,
    expires_at: expiresAt,
    hold_duration_minutes: 15,
    reservation_token: orderData.order_id,
    total_amount: Number(orderData.total_purchase || payload.total_amount || 0),
    currency: "CLP",
    service_id: payload.service_id,
    frequent_client: orderData.frequent_client,
  };
}

// =============================================================
// GDS FASE 4: Actualizar Reserva, Notificar Pago y Emitir
// Endpoint: POST /buses/update-reserve
// Endpoint: POST /buses/payment/notification
// Endpoint: GET /buses/success?order_id=...
// =============================================================

export async function updateReserve(payload: {
  client: {
    order_id: string;
    session_id: string;
    cod_phone: string;
    phone: string;
    email: string;
    payment_method: string;
    lang?: string;
  };
  reserves: Array<{
    ticket_id: string;
    document: string;
    document_type: string;
    first_name: string;
    last_name: string;
    country: string;
    birth_date?: string;
    cod_phone?: string;
    phone?: string;
    stops?: string;
    downs?: string;
  }>;
  products?: any[];
  frecuent_client_code?: number;
}): Promise<any> {
  const res = await apiFetch<any>("/buses/update-reserve", {
    method: "POST",
    body: JSON.stringify({
      client: {
        ...payload.client,
        lang: payload.client.lang || "es",
      },
      reserves: payload.reserves,
      products: payload.products || [],
      frecuent_client_code: payload.frecuent_client_code || 0,
    }),
  });
  return res.data;
}

export async function notifyPayment(payload: {
  status: "paid" | "created" | "fail";
  merchant_order_id: string;
  order_id: string;
  paid_amount: number;
  paid_currency?: string;
  payment_method?: string;
}): Promise<any> {
  const res = await apiFetch<any>("/buses/payment/notification", {
    method: "POST",
    body: JSON.stringify({
      status: payload.status,
      merchant_order_id: payload.merchant_order_id,
      order_id: payload.order_id,
      paid_amount: payload.paid_amount,
      paid_currency: payload.paid_currency || "CLP",
      payment_method: payload.payment_method || "SIMULACION",
    }),
  });
  return res.data;
}

export async function getSuccessOrder(orderId: string): Promise<any> {
  const res = await apiFetch<any>(`/buses/success?order_id=${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
  return res.data;
}

export async function confirmReservation(payload: {
  reservation_token: string;
  payment_reference: string;
  payment_method: string;
  meta: {
    buyer: BuyerData;
    passengers: PassengerData[];
    service: BusService;
    total_amount: number;
    order_id: string;
    session: string;
    tickets: Array<{ ticket_id: string; seat: number | string; stops?: string; downs?: string }>;
  };
}): Promise<IssuedTicket> {
  const { meta, payment_reference } = payload;
  const buyer = meta.buyer;

  // Extraer nombres y apellidos del comprador
  const buyerNameParts = (buyer.name || "").trim().split(" ");
  const buyerFirstName = buyer.first_name || buyerNameParts[0] || "Comprador";
  const buyerLastName = buyer.last_name || buyerNameParts.slice(1).join(" ") || "Cliente";

  // 1. POST /buses/update-reserve en el GDS
  const updateReservesPayload = meta.passengers.map((p, idx) => {
    const tkt = meta.tickets[idx] || meta.tickets[0];
    const pNameParts = (p.name || "").trim().split(" ");
    const pFirst = p.first_name || pNameParts[0] || buyerFirstName;
    const pLast = p.last_name || pNameParts.slice(1).join(" ") || buyerLastName;

    return {
      ticket_id: tkt?.ticket_id || meta.order_id,
      document: p.document_number.replace(/[^0-9kK]/g, ""),
      document_type: p.document_type || "RUT",
      first_name: pFirst,
      last_name: pLast,
      country: "CL",
      birth_date: p.birth_date || "1995-01-01",
      cod_phone: "+56",
      phone: buyer.phone.replace(/[^0-9]/g, ""),
      stops: p.stops || tkt?.stops || meta.service.origin_terminal,
      downs: p.downs || tkt?.downs || meta.service.destination_terminal,
    };
  });

  const cleanPhone = buyer.phone.replace(/[^0-9]/g, "");

  await updateReserve({
    client: {
      order_id: meta.order_id,
      session_id: meta.session,
      cod_phone: "+56",
      phone: cleanPhone || "912345678",
      email: buyer.email,
      payment_method: "WEBPAY",
      lang: "es",
    },
    reserves: updateReservesPayload,
    products: [],
    frecuent_client_code: 0,
  });

  // 2. POST /buses/payment/notification en el GDS
  await notifyPayment({
    status: "paid",
    merchant_order_id: meta.order_id,
    order_id: payment_reference,
    paid_amount: meta.total_amount,
    paid_currency: "CLP",
    payment_method: "SIMULACION",
  });

  // 3. GET /buses/success para obtener los datos definitivos del ticket del GDS
  let gdsSuccess: any = null;
  try {
    gdsSuccess = await getSuccessOrder(meta.order_id);
  } catch (e) {
    console.warn("Consulta a /buses/success retornó:", e);
  }

  const gdsTickets: any[] = gdsSuccess?.tickets || [];
  const primaryGdsTicket = gdsTickets[0];
  const ticketId = primaryGdsTicket?.ticket_id || meta.tickets[0]?.ticket_id || meta.order_id;
  const externalOrderId = gdsSuccess?.order_id || primaryGdsTicket?.order_id || meta.order_id;

  const ticket: IssuedTicket = {
    ticket_code: ticketId,
    ticket_id: ticketId,
    order_id: meta.order_id,
    external_order_id: externalOrderId,
    status: "ISSUED",
    purchase_date: new Date().toISOString(),
    buyer_email: buyer.email,
    reservation_token: meta.order_id,
    passenger: {
      name: meta.passengers.map((p) => p.name).join(", "),
      seat_number:
        primaryGdsTicket?.seat !== undefined
          ? gdsTickets.map((t) => t.seat).join(", ")
          : meta.passengers.map((p) => p.seat_number).join(", "),
      document_type: meta.passengers[0]?.document_type || "RUT",
      document_number: meta.passengers[0]?.document_number || buyer.document_number,
    },
    trip: {
      operator: primaryGdsTicket?.company_name || meta.service.operator_name,
      origin: `${primaryGdsTicket?.departure_city || meta.service.origin_city} (${primaryGdsTicket?.stops || meta.service.origin_terminal})`,
      destination: `${primaryGdsTicket?.destination_city || meta.service.destination_city} (${primaryGdsTicket?.downs || meta.service.destination_terminal})`,
      departure: primaryGdsTicket?.departure_date || meta.service.departure_time,
      arrival: primaryGdsTicket?.arrives_date || meta.service.arrival_time,
      origin_terminal: primaryGdsTicket?.stops || meta.service.origin_terminal,
      destination_terminal: primaryGdsTicket?.downs || meta.service.destination_terminal,
      seat_type: primaryGdsTicket?.seat_type || meta.passengers[0]?.seat_type || "SALON CAMA",
    },
    price_paid: Number(gdsSuccess?.amount_value || meta.total_amount),
    currency: gdsSuccess?.currency || "CLP",
    qr_code_url: `/qr/${ticketId}.png`,
    pdf_url: `https://back-qas.enbus.cl/api/v1/buses/download-ticket?ticket_id=${ticketId}`,
  };

  saveTicket(ticket);
  return ticket;
}

// =============================================================
// GDS FASE 5: Anular Boleto Real
// Endpoint: POST /buses/external/cancel-ticket
// =============================================================

export async function cancelTicket(payload: {
  ticket_code: string;
  buyer_email?: string;
  cancellation_reason?: string;
  order_id?: string;
  simulateOnPermissionError?: boolean;
}): Promise<CancellationResponse> {
  const saved = getSavedTickets().find(
    (t) =>
      t.ticket_code.toUpperCase() === payload.ticket_code.toUpperCase() ||
      (t.ticket_id && t.ticket_id.toUpperCase() === payload.ticket_code.toUpperCase())
  );

  const orderId = payload.order_id || saved?.order_id || saved?.external_order_id || payload.ticket_code;
  const ticketId = saved?.ticket_id || payload.ticket_code;

  let gdsResponse: any = null;
  let status: "CANCELLED" | "ERROR" = "CANCELLED";
  let message = "Anulación realizada con éxito en el GDS.";
  let gdsErrorCode: number | undefined = undefined;
  let isSimulated = false;

  try {
    const res = await apiFetch<any>("/buses/external/cancel-ticket", {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        ticket_id: ticketId,
      }),
    });
    gdsResponse = res.data;
    message = gdsResponse?.message || "Anulación realizada con éxito en el GDS.";
  } catch (err: any) {
    gdsErrorCode = err.status || 500;
    if (payload.simulateOnPermissionError && err.status === 403) {
      status = "CANCELLED";
      isSimulated = true;
      message = "Boleto anulado localmente en modo simulación (La cuenta QA carece de permiso 'available_cancel' en Enbus).";
    } else {
      status = "ERROR";
      message = err.message || "Error al solicitar anulación en el GDS.";
    }
  }

  const paid = saved?.price_paid || 0;
  const refundPercent = 85;
  const refundAmount = Math.round((paid * refundPercent) / 100);
  const fee = paid - refundAmount;

  const cancellationResult: CancellationResponse = {
    ticket_code: payload.ticket_code,
    ticket_id: ticketId,
    order_id: orderId,
    status,
    refund_percentage: refundPercent,
    refund_amount: refundAmount,
    cancellation_fee: fee,
    currency: saved?.currency || "CLP",
    cancelled_at: new Date().toISOString(),
    reason: payload.cancellation_reason,
    message,
    error_code: gdsErrorCode,
    is_simulated: isSimulated,
  };

  if (status === "CANCELLED") {
    updateSavedTicket(payload.ticket_code, {
      status: "CANCELLED",
      cancellation_data: cancellationResult,
    });
  }

  return cancellationResult;
}

/**
 * Consulta un boleto por su identificador en el almacenamiento de compras de la sesión
 */
export async function getTicketDetails(ticketCode: string): Promise<IssuedTicket | null> {
  const cleanCode = (ticketCode || "").trim().toUpperCase();
  if (!cleanCode) return null;

  const local = getSavedTickets().find(
    (t) =>
      (t.ticket_code && t.ticket_code.trim().toUpperCase() === cleanCode) ||
      (t.ticket_id && t.ticket_id.trim().toUpperCase() === cleanCode) ||
      (t.order_id && t.order_id.trim().toUpperCase() === cleanCode)
  );
  return local || null;
}
