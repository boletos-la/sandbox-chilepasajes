# Front de Compra y Gestión de Pasajes — Chilepasajes / Enbus

Pequeño front de compra de pasajes de bus interurbanos y gestión de post-venta (anulación), desarrollado en **React 19 + TypeScript + Vite + Tailwind CSS**, siguiendo fielmente la arquitectura, estilos y lógica del proyecto **boletos-la** y las especificaciones técnicas del manual de integración de **Chilepasajes / Enbus**.

---

## 🚀 Características Principales

1. **Flujo Completo de Compra (5 Fases)**:
   - **Paso 1: Búsqueda de Servicios (`GET /locations/origins`, `GET /locations/destinations`, `GET /services/search`)**:
     - Catálogo de ciudades y terminales de Chile.
     - Selector de origen, destino con botón de inversión (swap) y rutas frecuentes.
     - Selector de fecha de ida y cantidad de pasajeros (1 a 6).
     - Filtros por clase de asiento (Semi Cama, Salón Cama, Premium) y ordenamiento por tarifa u horario.
     - Fichas de servicio con operador (Pullman Bus, Buses Chilepasajes, etc.), itinerario, terminales, duración, amenidades y tarifas en CLP.
   - **Paso 2: Mapa de Asientos Interactivo (`GET /services/:id/seats`)**:
     - Visualización del bus con cabina del conductor, pasillo central y baño.
     - Selector de niveles (Piso 1 y Piso 2).
     - Estados interactivos: Disponible, Seleccionado y Ocupado con precios por categoría.
     - Control estricto de cupos según cantidad de pasajeros.
   - **Paso 3: Formulario de Comprador y Pasajeros**:
     - Datos del titular: Nombre, Email, Teléfono (+56 9...) y RUT.
     - Validador oficial del RUT Chileno (SII Módulo 11) con formateo automático (`XX.XXX.XXX-Y`).
     - Asignación de cada pasajero a su asiento correspondiente.
   - **Paso 4: Reserva Temporal (Hold) y Pasarela de Pago (`POST /reservations`, `POST /reservations/confirm`)**:
     - Bloqueo temporal con TTL de 15 minutos y temporizador de cuenta regresiva en vivo.
     - Métodos de pago locales: Webpay Plus Transbank, CuentaRUT BancoEstado y Mercado Pago.
     - Confirmación y emisión inmediata del pasaje con código de orden y referencia de pago.
   - **Paso 5: Boleto Emitido / E-Ticket Oficial**:
     - Código oficial de Boleto / PNR (`TKT-ENB-XXXXXX`).
     - Renderizado de código QR interactivo para validación en el abordaje.
     - Comprobante con desglose de itinerario, pasajero, asiento y tarifa pagada en CLP.
     - Opciones para imprimir/descargar E-ticket, anular boleto o iniciar una nueva compra.

2. **Módulo Completo de Anulación de Boletos (`POST /tickets/cancel`)**:
   - Réplica exacta de la vista `/anular-boleto` de `boletos-la`.
   - Búsqueda por número de boleto/PNR y validación de coincidencia de RUT del titular.
   - Cálculo automático del reembolso según la ley chilena (devolución del 85% y retención del 15%).
   - Formulario de motivo de anulación y confirmación con RUT.
   - Emisión de certificado digital de anulación.

3. **Inspector de Red y API en Tiempo Real (Consola fetch)**:
   - Registro de cada llamada HTTP `fetch` realizada por la aplicación.
   - Visualización de Method, URL, Headers de autenticación (`Authorization: Bearer <API-KEY>`), Request Body, Status HTTP y Response JSON.
   - Editor en vivo para modificar el Host (`https://back-qas.enbus.cl/api/v1` o `/api/v`) y la API-Key.
   - Botón de diagnóstico para probar conectividad directa con el servidor QA.

4. **Persistencia Local ("Mis Boletos")**:
   - Guarda los boletos emitidos en `localStorage` para poder consultarlos y anularlos en cualquier momento.

---

## 🛠️ Tecnologías Utilizadas

- **React 19** + **TypeScript**
- **Vite 8** (Build ultrarrápido)
- **Tailwind CSS** (Paleta de colores oficial Boletos.la: Naranja `#ff6700`, Azul marino `#023caf`)
- **Lucide Icons**
- **Native Browser Fetch** (sin dependencias pesadas de HTTP, conforme al requerimiento)
- **QRCode** (generación de QR en canvas)
- **Validador SII Módulo 11** para RUT chileno

---

## ⚙️ Configuración y Datos de Integración

- **Host QAS**: `https://back-qas.enbus.cl/api/v1` (o `https://back-qas.enbus.cl/api/v`)
- **Api-Key QAS**: `sk_test_FtC48QXZHlbvE`
- **Encabezados HTTP**:
  ```http
  Authorization: Bearer sk_test_FtC48QXZHlbvE
  Content-Type: application/json
  Accept: application/json
  ```

---

## 💻 Instrucciones para Ejecutar

```bash
# 1. Instalar dependencias (ya instaladas)
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar para producción
npm run build
```

El servidor de desarrollo queda disponible en:
👉 `http://localhost:5173/`
