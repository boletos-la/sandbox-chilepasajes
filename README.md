# Front de Compra y Gestión de Pasajes — Chilepasajes / Enbus (Next.js)

Front completo de compra de pasajes de bus interurbanos y gestión de post-venta (anulación), desarrollado en **Next.js (App Router) + React 19 + TypeScript + Tailwind CSS**, siguiendo fielmente la arquitectura, estilos y lógica del proyecto **boletos-la** y las especificaciones técnicas del GDS oficial de **Chilepasajes / Enbus**.

---

## 🚀 Características Principales

1. **Flujo Completo de Compra (5 Fases)**:
   - **Paso 1: Búsqueda de Servicios (`GET /buses/get-roads`, `GET /buses/schedules`)**:
     - Catálogo de ciudades y terminales de Chile en vivo.
     - Selector de origen, destino con botón de inversión (swap) y rutas frecuentes.
     - Selector de fecha de ida y cantidad de pasajeros (1 a 6).
     - Filtros por clase de asiento (Semi Cama, Salón Cama, Premium) y ordenamiento por tarifa u horario.
     - Fichas de servicio con operador, itinerario, terminales, duración, amenidades y tarifas en CLP.
   - **Paso 2: Mapa de Asientos Interactivo (`POST /buses/seat-map`)**:
     - Visualización del bus con cabina del conductor, pasillo central y baño.
     - Selector de niveles (Piso 1 y Piso 2).
     - Estados interactivos: Disponible, Seleccionado y Ocupado con precios por categoría.
     - Botón de refresco en tiempo real de disponibilidad.
   - **Paso 3: Formulario de Comprador y Pasajeros**:
     - Datos del titular: Nombre, Email, Teléfono (+56 9...) y RUT.
     - Validador oficial del RUT Chileno (SII Módulo 11) con formateo automático (`XX.XXX.XXX-Y`).
     - Asignación de cada pasajero a su asiento correspondiente.
   - **Paso 4: Reserva Temporal (Hold) y Pago (`POST /buses/reserve`, `POST /buses/update-reserve`, `POST /buses/payment/notification`)**:
     - Bloqueo temporal con TTL de 15 minutos y temporizador de cuenta regresiva en vivo.
     - Modo Simulación aprobado y rechazo de prueba.
     - Registro de pasajeros y emisión inmediata del pasaje con código de orden en el GDS.
   - **Paso 5: Boleto Emitido / E-Ticket Oficial (`GET /buses/success`)**:
     - Código oficial de Boleto / Ticket ID.
     - Renderizado de código QR interactivo para validación en el abordaje.
     - Comprobante con desglose de itinerario, pasajero, asiento y tarifa pagada en CLP.
     - Opciones para imprimir/descargar E-ticket, anular boleto o iniciar una nueva compra.

2. **Módulo Completo de Anulación de Boletos (`POST /buses/external/cancel-ticket`)**:
   - Réplica exacta de la vista `/anular-boleto` de `boletos-la`.
   - Búsqueda por número de boleto/PNR y validación de coincidencia de RUT del titular.
   - Cálculo automático del reembolso según la ley chilena (devolución del 85% y retención del 15%).
   - Manejo amigable y simulación ante falta del permiso `available_cancel` en QA.

3. **Inspector de Red y API en Tiempo Real (Consola fetch)**:
   - Registro de cada llamada HTTP `fetch` realizada por la aplicación hacia el GDS.
   - Visualización de Method, URL, Headers de autenticación (`Authorization: Bearer <API-KEY>`), Request Body, Status HTTP y Response JSON.

---

## 🛠️ Tecnologías Utilizadas

- **Next.js 16 (App Router + Turbopack)**
- **React 19** + **TypeScript**
- **Tailwind CSS** (Paleta de colores oficial Boletos.la: Naranja `#ff6700`, Azul marino `#023caf`)
- **Lucide Icons**
- **Native Fetch**
- **QRCode** (generación de QR en canvas)
- **Validador SII Módulo 11** para RUT chileno

---

## ⚙️ Variables de Entorno (Next.js)

Se configuran en el archivo `.env` o `.env.local` con el prefijo obligatorio `NEXT_PUBLIC_`:

```bash
NEXT_PUBLIC_CHILEPASAJES_BASE_URL="https://back-qas.enbus.cl/api/v1"
NEXT_PUBLIC_CHILEPASAJES_API_KEY="sk_test_FtC48QXZHlbvE"
NEXT_PUBLIC_CHILEPASAJES_COMPLEMENT="pasajes"
NEXT_PUBLIC_CHILEPASAJES_DEVICE="P"
NEXT_PUBLIC_APP_NAME="Chilepasajes Sandbox"
NEXT_PUBLIC_DEFAULT_PHONE_PREFIX="+56"
NEXT_PUBLIC_HOLD_DURATION_MINUTES="15"
```

---

## 💻 Instrucciones para Ejecutar

```bash
# 1. Iniciar servidor de desarrollo
npm run dev

# 2. Compilar para producción
npm run build

# 3. Iniciar servidor de producción
npm start
```

El servidor queda disponible en:
👉 `http://localhost:3001/`
