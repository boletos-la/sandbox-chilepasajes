"use client";

import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  CheckCircle2,
  Ticket,
  Printer,
  RotateCcw,
  PlusCircle,
  MapPin,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Bus,
} from "lucide-react";
import type { IssuedTicket } from "../types";
import { formatCLP } from "../utils/rut";

interface Step5ConfirmationProps {
  ticket: IssuedTicket;
  onNewSearch: () => void;
  onCancelTicket: (ticketCode: string, rut?: string) => void;
}

export const Step5Confirmation: React.FC<Step5ConfirmationProps> = ({
  ticket,
  onNewSearch,
  onCancelTicket,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        `CHILEPASAJES:${ticket.ticket_code}|STATUS:${ticket.status}|PAX:${ticket.passenger.name}|SEAT:${ticket.passenger.seat_number}`,
        {
          width: 140,
          margin: 1,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        },
        (err) => {
          if (err) console.error("Error generating QR:", err);
        }
      );
    }
  }, [ticket]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Success Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
        <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md shadow-emerald-600/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">
          ¡Compra Confirmada y Boleto Emitido!
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          Tu transacción se procesó exitosamente con la API de Chilepasajes / Enbus. Tu pasaje digital ya se encuentra activo para abordar.
        </p>
      </div>

      {/* Official Boarding Pass (E-Ticket) Card */}
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-lg overflow-hidden print:border-none print:shadow-none">
        {/* Ticket Top Header */}
        <div className="bg-[#023caf] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff6700] text-white flex items-center justify-center shadow-md">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider block">
                Boleto Electrónico de Pasajero
              </span>
              <span className="font-extrabold text-base sm:text-lg">
                {ticket.trip.operator}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] text-blue-200 uppercase block font-semibold">
              Código de Boleto (PNR)
            </span>
            <span className="font-mono font-black text-lg sm:text-xl text-yellow-300 tracking-wider">
              {ticket.ticket_code}
            </span>
          </div>
        </div>

        {/* Ticket Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Route & Times */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Origen
              </span>
              <p className="text-xl font-black text-slate-900 leading-tight">
                {ticket.trip.origin}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#ff6700]" />
                {ticket.trip.origin_terminal || "Terminal Alameda"}
              </p>
            </div>

            <div className="hidden sm:flex flex-col items-center">
              <span className="text-xs font-mono font-bold text-slate-400">VIAJE</span>
              <div className="w-24 h-0.5 bg-slate-300 relative my-1">
                <div className="w-2 h-2 rounded-full bg-[#ff6700] absolute -top-[3px] right-0"></div>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold">Confirmado</span>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Destino
              </span>
              <p className="text-xl font-black text-slate-900 leading-tight">
                {ticket.trip.destination}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#023caf]" />
                {ticket.trip.destination_terminal || "Terminal Rodoviario"}
              </p>
            </div>
          </div>

          {/* Passenger & Ticket Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-slate-100 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-0.5 uppercase">
                Pasajero
              </span>
              <span className="font-extrabold text-slate-900 text-sm">
                {ticket.passenger.name}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-0.5 uppercase">
                Documento
              </span>
              <span className="font-mono font-bold text-slate-800">
                {ticket.passenger.document_type || "RUT"}: {ticket.passenger.document_number}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-0.5 uppercase">
                Asiento(s)
              </span>
              <span className="font-black text-base text-[#ff6700]">
                {ticket.passenger.seat_number}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {ticket.trip.seat_type || "Salón Cama"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-0.5 uppercase">
                Fecha & Hora
              </span>
              <span className="font-bold text-slate-800 block">
                {ticket.trip.departure.split("T")[0]}
              </span>
              <span className="font-black text-slate-900">
                {ticket.trip.departure.split("T")[1]?.slice(0, 5) || "08:30"} hrs
              </span>
            </div>
          </div>

          {/* Bottom QR & Boarding Info */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ESTADO: {ticket.status}
                </span>
                {ticket.payment_status?.is_confirmed && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    GDS: CONFIRMADO
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Emitido el {new Date(ticket.purchase_date).toLocaleDateString("es-CL")}
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-sm">
                Presenta este código QR y tu cédula de identidad o pasaporte directamente al abordar el bus.
              </p>
              <div className="text-xs font-bold text-slate-700">
                Total Pagado: <span className="text-[#ff6700] font-black text-sm">{formatCLP(ticket.price_paid)}</span>
              </div>
            </div>

            {/* QR Canvas */}
            <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm shrink-0">
              <canvas ref={canvasRef} className="rounded-lg" />
              <p className="text-[10px] text-center font-mono text-slate-400 mt-1">
                VALIDACIÓN OFICIAL
              </p>
            </div>
          </div>
        </div>

        {/* Ticket Bottom Tear-off bar */}
        <div className="bg-slate-50 border-t border-dashed border-slate-300 p-4 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Respaldado por el operador de transporte interurbano</span>
          </span>
          <span className="font-mono text-[11px]">Enbus Chile API v1</span>
        </div>
      </div>

      {/* Action CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 print:hidden">
        <button
          onClick={handlePrint}
          className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-md flex items-center justify-center gap-2 transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Guardar E-Ticket</span>
        </button>

        <button
          onClick={() =>
            onCancelTicket(
              ticket.ticket_code,
              ticket.passenger.document_number
            )
          }
          className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-2 transition-all"
        >
          <RotateCcw className="w-4 h-4 text-rose-600" />
          <span>Solicitar Anulación de Boleto</span>
        </button>

        <button
          onClick={onNewSearch}
          className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs bg-[#ff6700] hover:bg-[#e65c00] text-white shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Comprar Otro Pasaje</span>
        </button>
      </div>
    </div>
  );
};
