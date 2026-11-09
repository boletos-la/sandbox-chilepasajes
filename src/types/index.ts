export interface Terminal {
  id: number | string;
  name: string;
}

export interface LocationCity {
  id: number;
  name: string;
  search_name: string;
  region?: string;
  terminals?: Terminal[];
}

export interface SeatClass {
  type: string;
  price: number;
  available_seats: number;
}

export interface BusService {
  service_id: string;
  company_id?: number;
  operator_name: string;
  operator_logo?: string;
  departure_time: string;
  departs_at_hour?: string;
  arrival_time: string;
  arrives_at_hour?: string;
  origin_city: string;
  destination_city: string;
  origin_terminal: string;
  destination_terminal: string;
  duration?: string;
  seat_classes: SeatClass[];
  amenities: string[];
  token: string;
  available_seats: number;
  price: number;
  currency: string;
  route_description?: string;
  is_cancellable?: boolean;
  rating_stats?: { average_rating?: number; total_reviews?: number };
}

export interface Seat {
  seat_number: string;
  floor: number;
  type: string;
  status: "available" | "occupied" | "selected";
  price: number;
  row?: number;
  column?: number;
  cell?: number;
  order?: number;
  idreserve: string;
  mov_redu?: boolean;
  pet?: boolean;
}

export interface SeatMapResponse {
  service_id: string;
  floors: number;
  cant_floors: number;
  limit_reserve?: number;
  seats: Seat[];
  stops?: {
    subida: Array<{ name: string; id: number }>;
    bajada: Array<{ name: string; id: number }>;
  };
}

export interface BuyerData {
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  document_type: "RUT" | "PASAPORTE" | "DNI";
  document_number: string;
}

export interface PassengerData {
  seat_number: string;
  name: string;
  first_name?: string;
  last_name?: string;
  document_type: "RUT" | "PASAPORTE" | "DNI";
  document_number: string;
  price?: number;
  seat_type?: string;
  floor?: number;
  idreserve?: string;
  birth_date?: string;
  stops?: string;
  downs?: string;
  ticket_id?: string;
}

export interface GdsTicketOrder {
  ticket_id: string;
  company_ticket_id?: string;
  order_id: string;
  session: string;
  price: number;
  seat: number | string;
  seat_type: string;
  stops?: string;
  downs?: string;
  departure_date: string;
}

export interface ReservationResponse {
  order_id: string;
  session: string;
  purchase_date?: string;
  total_purchase: number;
  tickets: GdsTicketOrder[];
  expires_at: string;
  hold_duration_minutes: number;
  reservation_token: string;
  total_amount: number;
  currency: string;
  service_id?: string;
  frequent_client?: boolean;
}

export interface IssuedTicket {
  ticket_code: string;
  ticket_id?: string;
  order_id: string;
  external_order_id?: string;
  status: "ISSUED" | "CANCELLED" | "REFUNDED";
  purchase_date: string;
  buyer_email?: string;
  reservation_token?: string;
  passenger: {
    name: string;
    seat_number: string;
    document_type?: string;
    document_number?: string;
  };
  trip: {
    operator: string;
    origin: string;
    destination: string;
    departure: string;
    arrival?: string;
    origin_terminal?: string;
    destination_terminal?: string;
    seat_type?: string;
  };
  price_paid: number;
  currency: string;
  qr_code_url?: string;
  pdf_url?: string;
  cancellation_data?: CancellationResponse;
}

export interface CancellationResponse {
  ticket_code: string;
  ticket_id?: string;
  order_id?: string;
  status: "CANCELLED" | "REFUNDED" | "ERROR";
  refund_percentage?: number;
  refund_amount?: number;
  cancellation_fee?: number;
  currency?: string;
  cancelled_at?: string;
  reason?: string;
  message?: string;
  error_code?: number;
  is_simulated?: boolean;
}

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  status: number;
  statusText: string;
  responseBody: any;
  durationMs: number;
  isMockFallback?: boolean;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  mode: "standard" | "gds_direct";
}
