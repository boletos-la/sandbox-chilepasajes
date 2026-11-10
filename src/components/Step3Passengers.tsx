"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Phone,
  FileText,
  ShieldCheck,
  AlertCircle,
  Armchair,
  Check,
} from "lucide-react";
import type { Seat, BusService, BuyerData, PassengerData, LocationCity } from "../types";
import { formatChileanRut, validateChileanRut, formatCLP } from "../utils/rut";

interface Step3PassengersProps {
  service: BusService;
  selectedSeats: Seat[];
  searchParams: { origin: LocationCity; destination: LocationCity; date: string };
  stops?: { subida?: string; bajada?: string };
  onProceed: (buyer: BuyerData, passengers: PassengerData[]) => void;
  onBack: () => void;
}

export const Step3Passengers: React.FC<Step3PassengersProps> = ({
  service,
  selectedSeats,
  searchParams,
  stops,
  onProceed,
  onBack,
}) => {
  // Buyer state
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+56 9 ");
  const [buyerDocType, setBuyerDocType] = useState<"RUT" | "PASAPORTE" | "DNI">("RUT");
  const [buyerDocNum, setBuyerDocNum] = useState("");

  // Checkbox: Buyer is Passenger 1
  const [buyerIsPax1, setBuyerIsPax1] = useState(true);

  // Passengers state
  const [passengers, setPassengers] = useState<PassengerData[]>(() =>
    selectedSeats.map((seat) => ({
      seat_number: seat.seat_number,
      name: "",
      document_type: "RUT",
      document_number: "",
      price: seat.price,
      seat_type: seat.type,
      floor: seat.floor,
      idreserve: seat.idreserve,
      stops: stops?.subida || service.origin_terminal,
      downs: stops?.bajada || service.destination_terminal,
    }))
  );

  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Format buyer rut on input
  const handleBuyerDocChange = (val: string) => {
    if (buyerDocType === "RUT") {
      setBuyerDocNum(formatChileanRut(val));
    } else {
      setBuyerDocNum(val.toUpperCase());
    }
  };

  // Format passenger rut on input
  const handlePaxDocChange = (index: number, val: string) => {
    const docType = passengers[index].document_type;
    const formatted = docType === "RUT" ? formatChileanRut(val) : val.toUpperCase();
    const copy = [...passengers];
    copy[index].document_number = formatted;
    setPassengers(copy);
  };

  const handlePaxNameChange = (index: number, val: string) => {
    const copy = [...passengers];
    copy[index].name = val;
    setPassengers(copy);
  };

  const handlePaxDocTypeChange = (index: number, type: "RUT" | "PASAPORTE" | "DNI") => {
    const copy = [...passengers];
    copy[index].document_type = type;
    setPassengers(copy);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    // Validate Buyer
    if (!buyerName.trim()) errors.push("Ingresa el nombre del comprador.");
    if (!buyerPhone.trim() || buyerPhone.length < 8)
      errors.push("Ingresa un teléfono de contacto válido.");

    if (buyerDocType === "RUT") {
      if (!validateChileanRut(buyerDocNum)) {
        errors.push("El RUT del comprador no es válido (revisa formato y dígito verificador).");
      }
    } else if (!buyerDocNum.trim()) {
      errors.push("Ingresa el número de documento del comprador.");
    }

    // Sync Passenger 1 if buyer is pax 1
    const currentPax = [...passengers];
    if (buyerIsPax1 && currentPax.length > 0) {
      currentPax[0].name = buyerName;
      currentPax[0].document_type = buyerDocType;
      currentPax[0].document_number = buyerDocNum;
    }

    // Validate Passengers
    currentPax.forEach((p, idx) => {
      if (!p.name.trim()) errors.push(`Ingresa el nombre para el Pasajero ${idx + 1} (Asiento ${p.seat_number}).`);
      if (p.document_type === "RUT") {
        if (!validateChileanRut(p.document_number)) {
          errors.push(`El RUT del Pasajero ${idx + 1} no es válido.`);
        }
      } else if (!p.document_number.trim()) {
        errors.push(`Ingresa el documento para el Pasajero ${idx + 1}.`);
      }
    });

    if (errors.length > 0) {
      setFormErrors(errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setFormErrors([]);
    onProceed(
      {
        name: buyerName.trim(),
        phone: buyerPhone.trim(),
        document_type: buyerDocType,
        document_number: buyerDocNum.trim(),
      },
      currentPax
    );
  };

  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Datos del Comprador y Pasajeros
            </h2>
            <p className="text-xs text-slate-500">
              {service.operator_name} • {searchParams.origin.name} → {searchParams.destination.name} ({searchParams.date})
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 font-bold block">Total pasajes:</span>
          <span className="text-base font-extrabold text-[#ff6700]">{formatCLP(totalAmount)}</span>
        </div>
      </div>

      {/* Validation Errors */}
      {formErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Por favor corrige los siguientes campos:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-rose-700 space-y-0.5">
            {formErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Buyer Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-[#ff6700] flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Datos del Comprador (Titular de Compra)
              </h3>
              <p className="text-xs text-slate-500">
                Información del titular para el registro y comprobante de viaje
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Nombre */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Nombre Completo *</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Juan Carlos Pérez González"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] outline-none"
                required
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Teléfono Móvil *</span>
              </label>
              <input
                type="tel"
                placeholder="+56 9 1234 5678"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] outline-none"
                required
              />
            </div>

            {/* Tipo Documento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Tipo Documento</span>
              </label>
              <select
                value={buyerDocType}
                onChange={(e) => setBuyerDocType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] outline-none"
              >
                <option value="RUT">RUT Chileno</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="DNI">DNI Extranjero</option>
              </select>
            </div>

            {/* Número Documento */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {buyerDocType === "RUT" ? "RUT (con dígito verificador) *" : "Nº Documento *"}
              </label>
              <input
                type="text"
                placeholder={buyerDocType === "RUT" ? "12.345.678-9" : "ABC123456"}
                value={buyerDocNum}
                onChange={(e) => handleBuyerDocChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] outline-none font-mono"
                required
              />
            </div>
          </div>

          {/* Quick toggle: Buyer is Passenger 1 */}
          <div className="pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={buyerIsPax1}
                onChange={(e) => setBuyerIsPax1(e.target.checked)}
                className="w-4 h-4 text-[#ff6700] rounded border-slate-300 focus:ring-[#ff6700]"
              />
              <span className="text-xs font-bold text-slate-700">
                El comprador es el Pasajero 1 (Asiento {selectedSeats[0]?.seat_number})
              </span>
            </label>
          </div>
        </div>

        {/* Passengers Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#023caf] flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Datos de los Pasajeros ({selectedSeats.length} {selectedSeats.length === 1 ? "asiento" : "asientos"})
              </h3>
              <p className="text-xs text-slate-500">
                Asigna el nombre y documento a cada asiento seleccionado
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {passengers.map((pax, idx) => {
              const isPax1AndBuyer = idx === 0 && buyerIsPax1;

              return (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#ff6700] text-white flex items-center justify-center text-xs font-black">
                        {pax.seat_number}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        Pasajero {idx + 1} — Asiento {pax.seat_number}
                      </span>
                      <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-semibold">
                        {pax.seat_type} • Piso {pax.floor}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#ff6700]">
                      {formatCLP(pax.price || 0)}
                    </span>
                  </div>

                  {isPax1AndBuyer ? (
                    <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Se utilizarán los mismos datos del comprador:{" "}
                        <strong>{buyerName || "—"}</strong> ({buyerDocNum || "—"})
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Nombre Completo Pasajero {idx + 1} *
                        </label>
                        <input
                          type="text"
                          placeholder="Nombre y Apellido"
                          value={pax.name}
                          onChange={(e) => handlePaxNameChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] outline-none"
                          required
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Tipo Doc.
                        </label>
                        <select
                          value={pax.document_type}
                          onChange={(e) => handlePaxDocTypeChange(idx, e.target.value as any)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] outline-none"
                        >
                          <option value="RUT">RUT</option>
                          <option value="PASAPORTE">Pasaporte</option>
                          <option value="DNI">DNI</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          {pax.document_type === "RUT" ? "RUT *" : "Nº Doc *"}
                        </label>
                        <input
                          type="text"
                          placeholder={pax.document_type === "RUT" ? "12.345.678-9" : "ABC123"}
                          value={pax.document_number}
                          onChange={(e) => handlePaxDocChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] outline-none font-mono"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
          >
            ← Volver a Asientos
          </button>

          <button
            type="submit"
            className="px-8 py-3 rounded-xl font-bold text-sm bg-[#ff6700] hover:bg-[#e65c00] text-white shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Bloquear Reserva y Proceder al Pago</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
