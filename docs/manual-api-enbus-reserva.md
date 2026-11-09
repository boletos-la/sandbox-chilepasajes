# Manual de Integración API REST — Plataforma Enbus / Chilepasajes

Este manual describe la arquitectura, la especificación de endpoints y la secuencia técnica completa para la integración con la API REST de Enbus (`back-qas.enbus.cl/docs`). Permite a desarrolladores e integradores implementar de forma robusta el flujo completo de compra y gestión de pasajes de bus interurbanos, abarcando desde la consulta del catálogo de rutas hasta la anulación de pasajes.

---

## 1. Arquitectura General, Autenticación y Entornos

### 1.1 Entorno de Pruebas (QAS)
- **Base URL QAS**: `back-qas.enbus.cl/api/v1`
- **Documentación Interactiva (Swagger/OpenAPI)**: `back-qas.enbus.cl/docs`
- **Formato de Intercambio**: JSON (`application/json`, codificación UTF-8)

### 1.2 Autenticación y Encabezados HTTP
Todas las peticiones a la API REST requieren autenticación mediante un Token Bearer otorgado en el panel de desarrollador.

#### Encabezados Estándar:
```http
Authorization: Bearer <TU_API_TOKEN>
Content-Type: application/json
Accept: application/json
X-Client-ID: <TU_CLIENT_ID>
```

---

## 2. Diagrama del Flujo Completo de Reserva

El ciclo de vida de la transacción de pasajes comprende 5 fases obligatorias:

1. **Cargar Orígenes y Destinos**: Obtención del catálogo de ciudades y paradas habilitadas.
2. **Buscar y Elegir Servicio**: Consulta de disponibilidad de frecuencias, tarifas y distribución de asientos.
3. **Reservar (Bloqueo Temporal / Hold)**: Registro del comprador/pasajeros y bloqueo temporal de asientos (TTL 15 minutos).
4. **Confirmar y Emitir Boleto**: Validación del pago y generación inmediata del boleto digital (E-Ticket / QR / PDF).
5. **Anular Boleto**: Procesamiento de la cancelación antes del viaje y cálculo del monto a reembolsar.

---

## 3. Especificación Detallada de Endpoints por Fase

### Fase 1: Cargar Orígenes y Destinos

Antes de iniciar una búsqueda, el sistema integrador debe sincronizar o listar las ciudades de origen y sus destinos asociados.

#### 1.1 Listar Ciudades de Origen
- **Método**: `GET`
- **Ruta**: `/locations/origins`

##### Ejemplo de Respuesta (`200 OK`):
```json
{
  "status": "success",
  "data": [
    {
      "id": 101,
      "name": "Santiago",
      "region": "Región Metropolitana",
      "terminals": [
        { "id": 1, "name": "Terminal Alameda" },
        { "id": 2, "name": "Terminal San Borja" }
      ]
    },
    {
      "id": 204,
      "name": "Viña del Mar",
      "region": "Región de Valparaíso",
      "terminals": [
        { "id": 5, "name": "Terminal Rodoviario Viña del Mar" }
      ]
    }
  ]
}
```

#### 1.2 Listar Destinos desde un Origen
- **Método**: `GET`
- **Ruta**: `/locations/destinations`
- **Parámetros Query**: `origin_id=101`

##### Ejemplo de Respuesta (`200 OK`):
```json
{
  "status": "success",
  "origin_id": 101,
  "data": [
    {
      "id": 305,
      "name": "Concepción",
      "region": "Región del Biobío"
    },
    {
      "id": 412,
      "name": "Puerto Montt",
      "region": "Región de Los Lagos"
    }
  ]
}
```

### Fase 2: Elegir un Servicio e Itinerario

Permite consultar los viajes disponibles para una fecha específica y ver el mapa de asientos en tiempo real.

#### 2.1 Buscar Servicios Disponibles
- **Método**: `GET`
- **Ruta**: `/services/search`
- **Parámetros Query**: `origin_id=101&destination_id=305&departure_date=2026-12-01`

| Parámetro | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `origin_id` | Integer | Sí | ID numérico de la ciudad de origen. |
| `destination_id` | Integer | Sí | ID numérico de la ciudad de destino. |
| `departure_date` | String | Sí | Fecha de ida en formato `YYYY-MM-DD`. |

##### Ejemplo de Respuesta (`200 OK`):
```json
{
  "status": "success",
  "total_results": 1,
  "data": [
    {
      "service_id": "SRV-88421",
      "operator_name": "Buses Chilepasajes",
      "departure_time": "2026-12-01T08:30:00-03:00",
      "arrival_time": "2026-12-01T14:00:00-03:00",
      "origin_terminal": "Terminal Alameda",
      "destination_terminal": "Terminal Collao",
      "seat_classes": [
        { "type": "Semi Cama", "price": 14000, "available_seats": 12 },
        { "type": "Salón Cama", "price": 20000, "available_seats": 4 }
      ]
    }
  ]
}
```

#### 2.2 Consultar Mapa de Asientos (Seatmap)
- **Método**: `GET`
- **Ruta**: `/services/SRV-88421/seats`

##### Ejemplo de Respuesta (`200 OK`):
```json
{
  "status": "success",
  "service_id": "SRV-88421",
  "floors": 2,
  "seats": [
    { "seat_number": "12", "floor": 1, "type": "Salón Cama", "status": "available", "price": 20000 },
    { "seat_number": "13", "floor": 1, "type": "Salón Cama", "status": "occupied", "price": 20000 },
    { "seat_number": "25", "floor": 2, "type": "Semi Cama", "status": "available", "price": 14000 }
  ]
}
```

### Fase 3: Reservar (Bloqueo Temporal de Asientos)

Crea una reserva en estado retenido (`HOLD`) para garantizar los asientos por una ventana de tiempo definida (generalmente 15 minutos) mientras el usuario realiza el pago.

- **Método**: `POST`
- **Ruta**: `/reservations`

##### Cuerpo de la Petición (Request Body):
```json
{
  "service_id": "SRV-88421",
  "buyer": {
    "name": "Usuario Ejemplo",
    "email": "usuario@example.com",
    "phone": "+56900000000",
    "document_type": "RUT",
    "document_number": "12345678-9"
  },
  "passengers": [
    {
      "seat_number": "12",
      "name": "Usuario Ejemplo",
      "document_type": "RUT",
      "document_number": "12345678-9"
    }
  ]
}
```

##### Ejemplo de Respuesta (`201 Created`):
```json
{
  "status": "success",
  "data": {
    "reservation_token": "RES-2026-991823",
    "expires_at": "2026-11-09T08:53:47-03:00",
    "hold_duration_minutes": 15,
    "total_amount": 20000,
    "currency": "CLP"
  }
}
```

### Fase 4: Confirmar y Emitir Boleto

Confirma el pago de la reserva y genera los boletos definitivos con su correspondiente código de barra o QR para el abordaje.

- **Método**: `POST`
- **Ruta**: `/reservations/confirm`

##### Cuerpo de la Petición (Request Body):
```json
{
  "reservation_token": "RES-2026-991823",
  "payment_reference": "PAY-TX-8837192",
  "payment_method": "webpay"
}
```

##### Ejemplo de Respuesta (`200 OK`):
```json
{
  "status": "success",
  "data": {
    "ticket_code": "TKT-ENB-771829",
    "status": "ISSUED",
    "purchase_date": "2026-11-09T08:42:00-03:00",
    "passenger": {
      "name": "Usuario Ejemplo",
      "seat_number": "12"
    },
    "trip": {
      "operator": "Buses Chilepasajes",
      "origin": "Santiago (Terminal Alameda)",
      "destination": "Concepción (Terminal Collao)",
      "departure": "2026-12-01T08:30:00-03:00"
    },
    "qr_code_url": "/qr/TKT-ENB-771829.png",
    "pdf_url": "/pdf/TKT-ENB-771829.pdf"
  }
}
```

### Fase 5: Anular un Boleto

Solicita la anulación y devolución de un boleto previamente emitido, calculando los porcentajes de reembolso según el tiempo restante para la salida del servicio.

- **Método**: `POST`
- **Ruta**: `/tickets/cancel`

##### Cuerpo de la Petición (Request Body):
```json
{
  "ticket_code": "TKT-ENB-771829",
  "buyer_email": "usuario@example.com",
  "cancellation_reason": "Cambio de itinerario"
}
```

##### Ejemplo de Respuesta (`200 OK`):
```json
{
  "status": "success",
  "data": {
    "ticket_code": "TKT-ENB-771829",
    "status": "CANCELLED",
    "refund_percentage": 85,
    "refund_amount": 17000,
    "cancellation_fee": 3000,
    "currency": "CLP",
    "cancelled_at": "2026-11-09T08:45:00-03:00"
  }
}
```

---

## 4. Estructura de Errores y Códigos HTTP

| Código HTTP | Estado API | Causa y Descripción |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_PARAMETERS` | Faltan campos obligatorios o el formato de documento/email es inválido. |
| `401 Unauthorized` | `UNAUTHORIZED` | Token de autenticación no proporcionado, malformado o caducado. |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | El código de servicio, token de reserva o pasaje especificado no existe. |
| `409 Conflict` | `SEAT_UNAVAILABLE` | El asiento solicitado ya ha sido bloqueado o adquirido en otra transacción. |
| `422 Unprocessable` | `RESERVATION_EXPIRED` | Intento de confirmación de una reserva cuya ventana de retención (TTL) ha finalizado. |
| `500 Internal Error` | `SERVER_ERROR` | Falla imprevista en el servidor backend o pérdida de comunicación con el operador. |

##### Ejemplo de Estructura de Error:
```json
{
  "status": "error",
  "code": "SEAT_UNAVAILABLE",
  "message": "El asiento seleccionado ya no se encuentra disponible.",
  "timestamp": "2026-11-09T08:40:00-03:00"
}
```

