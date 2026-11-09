import React, { useState, useEffect } from "react";
import {
  Ticket,
  X,
  MapPin,
  Calendar,
  Clock,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import type { IssuedTicket } from "../types";
import { getSavedTickets } from "../services/api";
import { formatCLP } from "../utils/rut";

interface MyTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTicket: (ticket: IssuedTicket) => void;
  onCancelTicket: (ticketCode: string, rut?: string) => void;
}

export const MyTicketsModal: React.FC<MyTicketsModalProps> = ({
  isOpen,
  onClose,
  onSelectTicket,
  onCancelTicket,
}) => {
  const [tickets, setTickets] = useState<IssuedTicket[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTickets(getSavedTickets());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Mis Boletos Emitidos
              </h3>
              <p className="text-xs text-slate-500">
                Boletos registrados en tu sesión actual de compra
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {tickets.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">
                No tienes boletos emitidos aún
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Realiza una compra en el flujo para generar tu primer pasaje oficial con código QR y PNR.
              </p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const isCancelled = ticket.status === "CANCELLED" || ticket.status === "REFUNDED";

              return (
                <div
                  key={ticket.ticket_code}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-[#023caf]">
                        {ticket.ticket_code}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          isCancelled
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <span className="font-extrabold text-xs text-slate-900">
                      {formatCLP(ticket.price_paid)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#ff6700]" />
                      <span className="truncate">
                        {ticket.trip.origin} → {ticket.trip.destination}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ticket.trip.departure.split("T")[0]}</span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Pasajero: <strong>{ticket.passenger.name}</strong> (Asiento {ticket.passenger.seat_number})
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono">
                      RUT: {ticket.passenger.document_number}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        onSelectTicket(ticket);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver E-Ticket</span>
                    </button>

                    {!isCancelled && (
                      <button
                        onClick={() => {
                          onCancelTicket(
                            ticket.ticket_code,
                            ticket.passenger.document_number
                          );
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        <span>Anular</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
