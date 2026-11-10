"use client";

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
  FileDown,
  Search,
  Loader2,
  AlertCircle,
  Hash,
} from "lucide-react";
import type { IssuedTicket, TicketByUuidItem } from "../types";
import {
  getSavedTickets,
  downloadTicketPdf,
  downloadBoardingCardPdf,
  triggerFileDownload,
  getTicketsByUuid,
} from "../services/api";
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
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Consulta por UUID de orden (/buses/get-tickets-by-uuid)
  const [showUuidLookup, setShowUuidLookup] = useState(false);
  const [uuidQuery, setUuidQuery] = useState("");
  const [uuidLoading, setUuidLoading] = useState(false);
  const [uuidError, setUuidError] = useState<string | null>(null);
  const [uuidResults, setUuidResults] = useState<TicketByUuidItem[] | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTickets(getSavedTickets());
      setDownloadError(null);
      setUuidError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadTicket = async (ticket: IssuedTicket) => {
    const orderId = ticket.external_order_id || ticket.order_id;
    const ticketId = ticket.ticket_id || ticket.ticket_code;
    const key = `tkt-${ticket.ticket_code}`;
    setDownloadingKey(key);
    setDownloadError(null);

    try {
      const blob = await downloadTicketPdf(orderId, ticketId);
      triggerFileDownload(blob, `Boleto-${ticket.ticket_code}.pdf`);
    } catch (err: any) {
      setDownloadError(err.message || "Error al descargar el PDF del boleto desde el GDS.");
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleDownloadBoardingCard = async (ticket: IssuedTicket) => {
    const orderId = ticket.external_order_id || ticket.order_id;
    const ticketId = ticket.ticket_id || ticket.ticket_code;
    const key = `brd-${ticket.ticket_code}`;
    setDownloadingKey(key);
    setDownloadError(null);

    try {
      const blob = await downloadBoardingCardPdf(orderId, ticketId);
      triggerFileDownload(blob, `Tarjeta-Embarque-${ticket.ticket_code}.pdf`);
    } catch (err: any) {
      setDownloadError(
        err.message || "Error al descargar la tarjeta de embarque desde el GDS."
      );
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleLookupUuid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uuidQuery.trim()) return;
    setUuidLoading(true);
    setUuidError(null);
    setUuidResults(null);

    try {
      const list = await getTicketsByUuid(uuidQuery.trim());
      if (list.length === 0) {
        setUuidError("No se encontraron tickets asociados a este UUID en el GDS.");
      } else {
        setUuidResults(list);
      }
    } catch (err: any) {
      setUuidError(err.message || "Error al consultar tickets por UUID en el GDS.");
    } finally {
      setUuidLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
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
                Gestión, descarga oficial de PDFs y consulta por UUID de orden
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

        {/* Global Error Banner */}
        {downloadError && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{downloadError}</span>
          </div>
        )}

        {/* UUID Lookup Accordion Header */}
        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={() => setShowUuidLookup(!showUuidLookup)}
            className="w-full py-2 px-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between hover:bg-indigo-100/70 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-mono">
              <Hash className="w-3.5 h-3.5 text-indigo-600" />
              <span>Consultar Tickets por UUID (/buses/get-tickets-by-uuid)</span>
            </span>
            <span className="text-[11px] underline">
              {showUuidLookup ? "Ocultar" : "Abrir"}
            </span>
          </button>

          {showUuidLookup && (
            <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <form onSubmit={handleLookupUuid} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: d9bd038f-acc4-41cd-9644-1dfdc98c7166"
                  value={uuidQuery}
                  onChange={(e) => setUuidQuery(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={uuidLoading || !uuidQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {uuidLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Consultar GDS</span>
                </button>
              </form>

              {uuidError && (
                <p className="text-xs text-rose-600 font-medium">{uuidError}</p>
              )}

              {uuidResults && uuidResults.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Tickets devueltos por el GDS ({uuidResults.length}):
                  </span>
                  {uuidResults.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono font-bold text-indigo-900">
                          {t.external_detail_id || t.uuid}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Asiento {t.seat} ({t.seat_type}) — {formatCLP(t.price)}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Confirmado: {t.confirmed ? "SÍ" : "NO"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {tickets.length === 0 ? (
            <div className="text-center py-10 space-y-3">
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
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-end gap-1.5">
                    {/* Descargar PDF Ticket */}
                    <button
                      onClick={() => handleDownloadTicket(ticket)}
                      disabled={downloadingKey === `tkt-${ticket.ticket_code}`}
                      className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Descargar Boleto PDF Oficial (/buses/download-ticket)"
                    >
                      {downloadingKey === `tkt-${ticket.ticket_code}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>PDF Boleto</span>
                    </button>

                    {/* Descargar PDF Tarjeta Embarque */}
                    <button
                      onClick={() => handleDownloadBoardingCard(ticket)}
                      disabled={downloadingKey === `brd-${ticket.ticket_code}`}
                      className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-800 hover:bg-blue-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Descargar Tarjeta de Embarque PDF (/buses/download-boarding-card)"
                    >
                      {downloadingKey === `brd-${ticket.ticket_code}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>PDF Embarque</span>
                    </button>

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
