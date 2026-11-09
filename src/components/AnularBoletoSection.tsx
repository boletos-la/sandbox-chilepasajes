"use client";

import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileText,
  UserCheck,
  Bus,
  MapPin,
  Calendar,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import type { IssuedTicket, CancellationResponse } from "../types";
import { getTicketDetails, cancelTicket } from "../services/api";
import { cleanRut, formatChileanRut, validateChileanRut, formatCLP } from "../utils/rut";

interface AnularBoletoSectionProps {
  initialTicketCode?: string;
  initialRut?: string;
  onGoToBuy?: () => void;
}

export const AnularBoletoSection: React.FC<AnularBoletoSectionProps> = ({
  initialTicketCode = "",
  initialRut = "",
  onGoToBuy,
}) => {
  const [ticketNumber, setTicketNumber] = useState(initialTicketCode);
  const [passengerRut, setPassengerRut] = useState(initialRut ? formatChileanRut(initialRut) : "");

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [ticketData, setTicketData] = useState<IssuedTicket | null>(null);

  const [confirmRut, setConfirmRut] = useState("");
  const [confirmRutError, setConfirmRutError] = useState("");
  const [reason, setReason] = useState("Cambio de itinerario");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [is403PermissionError, setIs403PermissionError] = useState(false);
  const [cancellationResult, setCancellationResult] = useState<CancellationResponse | null>(null);

  // Auto search if initial ticket code provided
  useEffect(() => {
    if (initialTicketCode) {
      setTicketNumber(initialTicketCode);
      performSearch(initialTicketCode, initialRut);
    }
  }, [initialTicketCode, initialRut]);

  const performSearch = async (num: string, rutParam?: string) => {
    const cleanNum = num.trim().toUpperCase();
    if (!cleanNum) {
      setSearchError("Por favor ingresa el código de boleto o PNR oficial (ej. TKT-ENB-771829).");
      return;
    }

    const currentRut = rutParam !== undefined ? rutParam : passengerRut;
    const cleanInputRut = cleanRut(currentRut);

    if (currentRut.trim() && !validateChileanRut(currentRut)) {
      setSearchError("El RUT ingresado no es válido. Verifica el número y dígito verificador.");
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setTicketData(null);
    setSubmitSuccess(false);
    setSubmitError("");
    setCancellationResult(null);
    setConfirmRut("");
    setConfirmRutError("");

    try {
      const ticket = await getTicketDetails(cleanNum);

      if (ticket) {
        // Validar match de RUT si se ingresó
        if (cleanInputRut && ticket.passenger.document_number) {
          const ticketCleanRut = cleanRut(ticket.passenger.document_number);
          if (ticketCleanRut && ticketCleanRut !== cleanInputRut) {
            setSearchError(
              `El RUT ingresado (${formatChileanRut(currentRut)}) no coincide con el pasajero titular de este boleto.`
            );
            return;
          }
        }

        setTicketData(ticket);
        setConfirmRut(ticket.passenger.document_number || currentRut);
      } else {
        setSearchError(
          "No pudimos encontrar un boleto asociado a ese código. Verifica el número e intenta nuevamente."
        );
      }
    } catch (err: any) {
      console.error("[Anular Boleto Error]:", err);
      setSearchError("Ocurrió un error al consultar el boleto: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(ticketNumber);
  };

  const handleProcessCancellation = async (e?: React.FormEvent, forceSimulate: boolean = false) => {
    if (e) e.preventDefault();
    if (!ticketData) return;

    // Validación de RUT requerida para seguridad
    const rutToVerify = confirmRut.trim() || passengerRut.trim();
    if (!rutToVerify) {
      setConfirmRutError("Debes ingresar el RUT del pasajero para proceder con la anulación.");
      return;
    }

    if (!validateChileanRut(rutToVerify)) {
      setConfirmRutError("El RUT ingresado no es válido. Revisa formato y dígito verificador.");
      return;
    }

    const cleanInput = cleanRut(rutToVerify);
    const cleanTicketDoc = cleanRut(ticketData.passenger.document_number || "");
    if (cleanTicketDoc && cleanInput !== cleanTicketDoc) {
      setConfirmRutError(
        `El RUT ingresado no coincide con el registrado en el boleto (${ticketData.passenger.document_number}).`
      );
      return;
    }

    setConfirmRutError("");
    setIsSubmitting(true);
    setSubmitError("");
    setIs403PermissionError(false);

    try {
      const result = await cancelTicket({
        ticket_code: ticketData.ticket_code,
        buyer_email: ticketData.buyer_email || "usuario@ejemplo.cl",
        cancellation_reason: reason.trim() || "Anulación directa por el usuario",
        order_id: ticketData.order_id,
        simulateOnPermissionError: forceSimulate,
      });

      if (result.status === "ERROR") {
        if (
          result.error_code === 403 ||
          result.message?.toLowerCase().includes("no tienes permisos")
        ) {
          setIs403PermissionError(true);
          setSubmitError(
            `El GDS respondió con código 403: "${result.message}". La API-Key de QA (sk_test_...) no tiene asignado el permiso de seller "available_cancel" en la base de datos de Chilepasajes / Enbus.`
          );
        } else {
          setSubmitError(`Respuesta del GDS: ${result.message}`);
        }
        return;
      }

      setCancellationResult(result);
      setTicketData((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
      setSubmitSuccess(true);
    } catch (err: any) {
      console.error("[Cancellation Error]:", err);
      setSubmitError(err.message || "No fue posible anular el boleto en este momento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyCancelled = ticketData?.status === "CANCELLED" || ticketData?.status === "REFUNDED";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title & Introduction (Boletos.la style) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Anulación y Devolución de Boletos
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Flujo oficial de post-venta Fase 5 según el manual API REST Enbus
            </p>
          </div>
        </div>

        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5 mt-4">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Conforme a la normativa chilena de transporte, las solicitudes de anulación efectuadas con al menos 4 horas de anticipación a la salida del servicio tienen derecho a una devolución del <strong>85% del valor pagado</strong>.
          </p>
        </div>
      </div>

      {/* Search Ticket Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#ff6700]" />
          <span>Buscar Boleto a Anular</span>
        </h2>

        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Código de Boleto / PNR *
              </label>
              <input
                type="text"
                placeholder="Ej: TKT-ENB-771829"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value.toUpperCase())}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#ff6700] outline-none"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Figuran en tu comprobante o correo electrónico
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                RUT del Pasajero (opcional para filtro)
              </label>
              <input
                type="text"
                placeholder="Ej: 16.482.910-3"
                value={passengerRut}
                onChange={(e) => setPassengerRut(formatChileanRut(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-[#ff6700] outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Formato: 12.345.678-K
              </span>
            </div>
          </div>

          {searchError && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#023caf] hover:bg-[#01297a] text-white shadow-md flex items-center gap-2 transition-all disabled:opacity-60"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consultando boleto en API...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Consultar Boleto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Ticket Details & Cancellation Action */}
      {ticketData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-900">
                  Boleto Encontrado
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                    isAlreadyCancelled
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                  }`}
                >
                  {isAlreadyCancelled ? "ANULADO / REEMBOLSADO" : "VIGENTE (EMITIDO)"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Código: <strong>{ticketData.ticket_code}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block font-semibold">Monto Pagado:</span>
              <span className="font-black text-sm text-slate-900">
                {formatCLP(ticketData.price_paid)}
              </span>
            </div>
          </div>

          {/* Ticket Information Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 font-semibold block">Operador y Ruta</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {ticketData.trip.operator}
                </p>
                <p className="text-slate-600 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#ff6700]" />
                  {ticketData.trip.origin} → {ticketData.trip.destination}
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block">Salida Programada</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {ticketData.trip.departure.split("T")[0]} a las{" "}
                  {ticketData.trip.departure.split("T")[1]?.slice(0, 5) || "08:30"} hrs
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block">Pasajero Registrado</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {ticketData.passenger.name}
                </p>
                <p className="text-slate-600 font-mono">
                  {ticketData.passenger.document_type || "RUT"}: {ticketData.passenger.document_number}
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block">Asiento(s)</span>
                <p className="font-black text-base text-[#ff6700] mt-0.5">
                  Nº {ticketData.passenger.seat_number}
                </p>
                <p className="text-slate-500">{ticketData.trip.seat_type || "Salón Cama"}</p>
              </div>
            </div>
          </div>

          {isAlreadyCancelled ? (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center space-y-2">
              <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <h4 className="font-bold text-sm text-rose-900">
                Este boleto ya ha sido anulado previamente
              </h4>
              <p className="text-xs text-rose-700">
                El reembolso fue procesado. No es posible anularlo nuevamente.
              </p>
            </div>
          ) : (
            /* Form to perform cancellation */
            <form onSubmit={handleProcessCancellation} className="space-y-4 pt-2">
              <h3 className="font-extrabold text-sm text-slate-900">
                Confirmación de la Anulación
              </h3>

              {/* Refund calculation breakdown */}
              <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-4 text-xs space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>Monto original pagado:</span>
                  <span className="font-semibold">{formatCLP(ticketData.price_paid)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Retención legal por servicio (15%):</span>
                  <span className="font-semibold text-rose-600">
                    - {formatCLP(Math.round(ticketData.price_paid * 0.15))}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-orange-200">
                  <span>Monto total a devolver (85%):</span>
                  <span className="text-emerald-700">
                    {formatCLP(Math.round(ticketData.price_paid * 0.85))}
                  </span>
                </div>
              </div>

              {/* Confirm RUT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ingresa el RUT del pasajero titular para autorizar la anulación *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 16.482.910-3"
                  value={confirmRut}
                  onChange={(e) => setConfirmRut(formatChileanRut(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
                  required
                />
                {confirmRutError && (
                  <p className="text-xs text-rose-600 mt-1 font-semibold">
                    {confirmRutError}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de la cancelación *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value="Cambio de itinerario">Cambio de itinerario / fechas</option>
                  <option value="Motivos de fuerza mayor">Motivos de fuerza mayor o salud</option>
                  <option value="Cancelación de viaje">Cancelación de viaje personal</option>
                  <option value="Error al reservar">Error involuntario en los datos</option>
                </select>
              </div>

              {submitError && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-800 space-y-2.5">
                  <div className="flex items-start gap-2 text-rose-900 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>Error al anular en el GDS</span>
                  </div>
                  <p className="leading-relaxed">{submitError}</p>

                  {is403PermissionError && (
                    <div className="pt-2.5 border-t border-rose-200/80 space-y-2">
                      <p className="text-[11px] text-slate-600 leading-normal">
                        <strong>Explicación técnica:</strong> En la especificación OpenAPI de Enbus, la anulación directa exige que la cuenta del vendedor tenga activo el permiso <code className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-mono">available_cancel</code>. Mientras el equipo de soporte de Enbus lo habilita en la Api-Key de QA, puedes simular la anulación exitosa para completar y validar el flujo:
                      </p>
                      <button
                        type="button"
                        onClick={() => handleProcessCancellation(undefined, true)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Simular Anulación Exitosa (Modo Prueba QA)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando anulación en el GDS...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirmar Anulación en el GDS</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Cancellation Success Certificate */}
      {submitSuccess && cancellationResult && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Resultado de Anulación en el GDS
              </h3>
              <p className="text-xs text-slate-500">
                {cancellationResult.message || "Solicitud de cancelación procesada por Enbus / Chilepasajes"}
              </p>
              {cancellationResult.is_simulated && (
                <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Simulación QA (Seller sin permiso available_cancel en Enbus)
                </span>
              )}
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Código de Boleto / Ticket ID:</span>
              <span className="font-mono font-bold text-slate-900">
                {cancellationResult.ticket_code}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Estado:</span>
              <span className={`font-black ${cancellationResult.status === "CANCELLED" ? "text-rose-600" : "text-amber-600"}`}>
                {cancellationResult.status}
              </span>
            </div>
            {cancellationResult.refund_percentage !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-600">Porcentaje Reembolsado:</span>
                <span className="font-bold text-slate-900">
                  {cancellationResult.refund_percentage}%
                </span>
              </div>
            )}
            {cancellationResult.cancellation_fee !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-600">Cargo de Anulación (Fee):</span>
                <span className="font-semibold text-rose-600">
                  {formatCLP(cancellationResult.cancellation_fee || 0)}
                </span>
              </div>
            )}
            {cancellationResult.refund_amount !== undefined && (
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-emerald-200">
                <span>Monto a Devolver:</span>
                <span className="text-emerald-700">
                  {formatCLP(cancellationResult.refund_amount || 0)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span>Fecha de anulación:</span>
              <span>{new Date(cancellationResult.cancelled_at || Date.now()).toLocaleString("es-CL")}</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            {onGoToBuy && (
              <button
                onClick={onGoToBuy}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#ff6700] hover:bg-[#e65c00] text-white shadow-md"
              >
                Comprar un nuevo pasaje
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
