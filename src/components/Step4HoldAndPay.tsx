"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Lock,
  Clock,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Armchair,
  User,
  Bus,
} from "lucide-react";
import type {
  BusService,
  Seat,
  BuyerData,
  PassengerData,
  ReservationResponse,
  IssuedTicket,
  LocationCity,
} from "../types";
import { createReservation, confirmReservation } from "../services/api";
import { formatCLP } from "../utils/rut";

interface Step4HoldAndPayProps {
  service: BusService;
  selectedSeats: Seat[];
  buyer: BuyerData;
  passengers: PassengerData[];
  searchParams: { origin: LocationCity; destination: LocationCity; date: string };
  sessionUuid: string;
  onSuccess: (ticket: IssuedTicket) => void;
  onBack: () => void;
}

export const Step4HoldAndPay: React.FC<Step4HoldAndPayProps> = ({
  service,
  selectedSeats,
  buyer,
  passengers,
  searchParams,
  sessionUuid,
  onSuccess,
  onBack,
}) => {
  const [holding, setHolding] = useState(true);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);

  // Cuenta regresiva en segundos (15 minutos = 900s)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15 * 60);

  // Método de Pago (Modo Simulación)
  const [paymentMethod, setPaymentMethod] = useState<string>("simulacion_aprobada");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Crear Hold en el GDS al montar el componente
  useEffect(() => {
    let isCancelled = false;

    async function initHold() {
      try {
        setHolding(true);
        setHoldError(null);

        const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);
        const reservesTokens = selectedSeats.map((s) => s.idreserve).filter(Boolean);

        if (reservesTokens.length === 0) {
          throw new Error("No se encontraron tokens idreserve válidos para los asientos seleccionados.");
        }

        const res = await createReservation({
          session: sessionUuid,
          reserves: reservesTokens,
          service_id: service.service_id,
          total_amount: totalAmount,
        });

        if (!isCancelled) {
          setReservation(res);

          if (res.expires_at) {
            const expTime = new Date(res.expires_at).getTime();
            const now = Date.now();
            const diffSeconds = Math.max(0, Math.round((expTime - now) / 1000));
            setSecondsRemaining(diffSeconds > 0 ? diffSeconds : 15 * 60);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          const rawMsg = err.message || "";
          if (
            rawMsg.toLowerCase().includes("error al reservar asiento") ||
            err.status === 400 ||
            rawMsg.toLowerCase().includes("payload is invalid")
          ) {
            setHoldError(
              "El asiento seleccionado ya fue bloqueado o adquirido en el GDS por otra sesión. Por favor regresa al mapa y elige otro asiento disponible."
            );
          } else if (rawMsg.toLowerCase().includes("too_many_holds") || err.status === 429) {
            setHoldError(
              "Límite de reservas activas temporales excedido en el GDS (TOO_MANY_HOLDS). Espera unos instantes para que expiren las reservas previas o intenta con otro asiento."
            );
          } else {
            setHoldError(rawMsg || "Error al bloquear los asientos en el GDS de Enbus.");
          }
        }
      } finally {
        if (!isCancelled) {
          setHolding(false);
        }
      }
    }

    initHold();
    return () => {
      isCancelled = true;
    };
  }, [service.service_id, sessionUuid]);

  // Intervalo del timer de 15 minutos
  useEffect(() => {
    if (holding || !reservation || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [holding, reservation]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;

    if (secondsRemaining <= 0) {
      setPayError(
        "El tiempo de bloqueo temporal en el GDS ha expirado. Debes volver a seleccionar tus asientos."
      );
      return;
    }

    if (paymentMethod === "simulacion_rechazada") {
      setPaying(true);
      setPayError(null);
      setTimeout(() => {
        setPaying(false);
        setPayError(
          "Simulación: Transacción rechazada por el emisor (Fondos insuficientes o tarjeta inválida). Cambia a 'Simular Pago Exitoso' para continuar."
        );
      }, 700);
      return;
    }

    setPaying(true);
    setPayError(null);

    const paymentRef = `PAY-SIM-${Math.floor(1000000 + Math.random() * 9000000)}`;

    try {
      const issued = await confirmReservation({
        reservation_token: reservation.order_id,
        payment_reference: paymentRef,
        payment_method: paymentMethod,
        meta: {
          buyer,
          passengers,
          service,
          total_amount: reservation.total_amount,
          order_id: reservation.order_id,
          session: reservation.session,
          tickets: reservation.tickets,
        },
      });

      onSuccess(issued);
    } catch (err: any) {
      setPayError(err.message || "Error al confirmar la orden y emitir el boleto en el GDS.");
      setPaying(false);
    }
  };

  const totalAmount =
    reservation?.total_amount || selectedSeats.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={paying}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors border border-slate-200 disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Confirmación de Reserva y Pago en GDS
            </h2>
            <p className="text-xs text-slate-500">
              Hold de Asientos (POST /buses/reserve) y Emisión Oficial (POST /buses/update-reserve)
            </p>
          </div>
        </div>
      </div>

      {holding ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#ff6700] animate-spin mx-auto" />
          <h3 className="font-extrabold text-slate-800 text-base">
            Bloqueando asientos en el GDS (POST /buses/reserve)...
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Enviando tokens <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[#023caf]">idreserve</code> y generando la orden en Enbus
          </p>
        </div>
      ) : holdError ? (
        <div className="bg-rose-50 border border-rose-200 p-6 sm:p-8 rounded-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-rose-900">
                Aviso de Disponibilidad en el GDS
              </h3>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">{holdError}</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onBack}
              className="px-5 py-3 bg-[#ff6700] hover:bg-[#e65c00] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Mapa y Elegir Otro Asiento Disponible</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Payment Section */}
          <div className="lg:col-span-8 space-y-6">
            {/* Hold Token & TTL Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                      Asientos Bloqueados en GDS
                    </span>
                    <span className="bg-emerald-200 text-emerald-800 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
                      TTL 15 Min
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-mono mt-0.5">
                    Order ID GDS: <strong>{reservation?.order_id}</strong>
                  </p>
                </div>
              </div>

              {/* Countdown badge */}
              <div
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-center shrink-0 ${
                  secondsRemaining < 180
                    ? "bg-rose-100 text-rose-700 border border-rose-300 animate-pulse"
                    : "bg-white text-slate-800 border border-emerald-200 shadow-2xs"
                }`}
              >
                <Clock className="w-4 h-4 text-[#ff6700]" />
                <div>
                  <span className="text-[10px] block font-bold text-slate-500 uppercase leading-none">
                    Tiempo restante
                  </span>
                  <span className="text-lg font-black font-mono leading-tight">
                    {formatTimer(secondsRemaining)}
                  </span>
                </div>
              </div>
            </div>

            {/* Expired warning if timer zero */}
            {secondsRemaining <= 0 && (
              <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-rose-800 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Tiempo de retención agotado</h4>
                  <p className="text-xs mt-0.5">
                    La reserva temporal expiró en el servidor del GDS. Debes regresar al mapa para bloquear nuevamente los asientos.
                  </p>
                </div>
              </div>
            )}

            {/* Payment Method Selector - Solo Simulación */}
            <form
              onSubmit={handleConfirmPayment}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5"
            >
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#023caf]" />
                  <span>Método de Pago (Modo Simulación)</span>
                </h3>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                  Sandbox GDS Activo
                </span>
              </div>

              <div className="space-y-3">
                {/* Simulación Pago Aprobado */}
                <label
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                    paymentMethod === "simulacion_aprobada"
                      ? "border-[#ff6700] bg-orange-50/40 shadow-xs ring-1 ring-orange-200"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-slate-900">
                          Simular Pago Exitoso (Inmediato)
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                          Recomendado
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Registra los pasajeros con <code className="font-mono">/buses/update-reserve</code>, notifica el pago con <code className="font-mono">/buses/payment/notification</code> y emite el boleto oficial en el GDS.
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="payment_method"
                    value="simulacion_aprobada"
                    checked={paymentMethod === "simulacion_aprobada"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="text-[#ff6700] focus:ring-[#ff6700] mt-1"
                  />
                </label>

                {/* Simulación Rechazo de Pago para pruebas */}
                <label
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                    paymentMethod === "simulacion_rechazada"
                      ? "border-rose-500 bg-rose-50/40 shadow-xs ring-1 ring-rose-200"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-black text-xs text-slate-900">
                        Simular Rechazo de Pago (Para Pruebas de Error)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Permite verificar el manejo de excepciones y reintentos ante fondos insuficientes o tarjeta rechazada.
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="payment_method"
                    value="simulacion_rechazada"
                    checked={paymentMethod === "simulacion_rechazada"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="text-rose-500 focus:ring-rose-500 mt-1"
                  />
                </label>
              </div>

              {payError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {/* Submit Payment Button */}
              <button
                type="submit"
                disabled={paying || secondsRemaining <= 0}
                className="w-full py-3.5 rounded-xl font-black text-sm bg-[#ff6700] hover:bg-[#e65c00] text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Confirmando y emitiendo boleto en el GDS...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pagar {formatCLP(totalAmount)} (Modo Simulación)</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Bus className="w-4 h-4 text-[#ff6700]" />
                <span>Detalle de tu Viaje GDS</span>
              </h3>

              {/* Service Info */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Operador:</span>
                  <span className="font-bold text-slate-800">{service.operator_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Origen:</span>
                  <span className="font-bold text-slate-800">{service.origin_terminal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destino:</span>
                  <span className="font-bold text-slate-800">{service.destination_terminal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha:</span>
                  <span className="font-bold text-slate-800">{searchParams.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Salida:</span>
                  <span className="font-bold text-slate-800">
                    {service.departs_at_hour || service.departure_time.split("T")[1]?.slice(0, 5) || "08:30"}
                  </span>
                </div>
              </div>

              {/* Asientos */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
                  <Armchair className="w-3.5 h-3.5 text-[#ff6700]" />
                  <span>Asientos ({selectedSeats.length}):</span>
                </span>
                <div className="space-y-1.5">
                  {selectedSeats.map((st) => (
                    <div
                      key={st.seat_number}
                      className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                    >
                      <span className="font-bold text-slate-800">
                        N° {st.seat_number} ({st.type})
                      </span>
                      <span className="font-extrabold text-[#ff6700]">{formatCLP(st.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comprador */}
              <div className="pt-3 border-t border-slate-100 text-xs space-y-1">
                <span className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#023caf]" />
                  <span>Comprador:</span>
                </span>
                <p className="font-medium text-slate-800">{buyer.name}</p>
                <p className="text-slate-500">{buyer.email}</p>
                <p className="text-slate-500">RUT: {buyer.document_number}</p>
              </div>

              {/* Total */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">Total:</span>
                <span className="text-xl font-black text-[#ff6700]">
                  {formatCLP(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
