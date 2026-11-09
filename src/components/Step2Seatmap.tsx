import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Armchair,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  MapPin,
  Calendar,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import type { BusService, Seat, LocationCity, SeatMapResponse } from "../types";
import { fetchSeatMap } from "../services/api";
import { formatCLP } from "../utils/rut";

interface Step2SeatmapProps {
  service: BusService;
  passengerCount: number;
  sessionUuid: string;
  searchParams: { origin: LocationCity; destination: LocationCity; date: string };
  onProceed: (selectedSeats: Seat[], stops?: { subida?: string; bajada?: string }) => void;
  onBack: () => void;
}

export const Step2Seatmap: React.FC<Step2SeatmapProps> = ({
  service,
  passengerCount,
  sessionUuid,
  searchParams,
  onProceed,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seatmap, setSeatmap] = useState<SeatMapResponse | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [selectedSubida, setSelectedSubida] = useState<string>("");
  const [selectedBajada, setSelectedBajada] = useState<string>("");

  const loadSeats = async () => {
    try {
      setLoading(true);
      setError(null);
      const map = await fetchSeatMap(service.token, sessionUuid);
      setSeatmap(map);
      if (map.stops?.subida && map.stops.subida.length > 0) {
        setSelectedSubida(map.stops.subida[0].name);
      }
      if (map.stops?.bajada && map.stops.bajada.length > 0) {
        setSelectedBajada(map.stops.bajada[0].name);
      }
    } catch (err: any) {
      setError("Error devuelto por la API del GDS al consultar asientos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeats();
  }, [service.token, sessionUuid]);

  const handleSeatClick = (seat: Seat) => {
    if (seat.status === "occupied") return;

    const alreadySelected = selectedSeats.some((s) => s.seat_number === seat.seat_number);

    if (alreadySelected) {
      setSelectedSeats(selectedSeats.filter((s) => s.seat_number !== seat.seat_number));
    } else {
      if (selectedSeats.length >= passengerCount) {
        if (passengerCount === 1) {
          setSelectedSeats([seat]);
        } else {
          setSelectedSeats([...selectedSeats.slice(1), seat]);
        }
      } else {
        setSelectedSeats([...selectedSeats, seat]);
      }
    }
  };

  const currentFloorSeats = (seatmap?.seats || []).filter((s) => s.floor === activeFloor);

  // Agrupar asientos por orden/fila (GDS order o cell)
  const rowsMap = new Map<number, Seat[]>();
  currentFloorSeats.forEach((seat) => {
    // Si la API provee 'order', usarlo; si no, calcular por número
    const rowNum = seat.order || Math.ceil(Number(seat.seat_number) / 4) || 1;
    if (!rowsMap.has(rowNum)) rowsMap.set(rowNum, []);
    rowsMap.get(rowNum)!.push(seat);
  });
  const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);

  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const isSelectionComplete = selectedSeats.length === passengerCount;

  return (
    <div className="space-y-6">
      {/* Top summary card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors border border-slate-200 shrink-0"
            title="Volver a búsqueda"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">
                {service.operator_name}
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
                GDS #{service.service_id}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#ff6700]" />
                {searchParams.origin.name} → {searchParams.destination.name}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {searchParams.date}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Salida: {service.departs_at_hour || service.departure_time.split("T")[1]?.slice(0, 5) || "08:30"}
              </span>
            </div>
          </div>
        </div>

        {/* Counter indicator & Refresh */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSeats}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Refrescar disponibilidad en tiempo real"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#ff6700]" : ""}`} />
          </button>
          <div className="bg-orange-50 border border-orange-200 px-4 py-2 rounded-xl text-left md:text-right shrink-0">
            <span className="text-xs text-slate-500 font-bold block">
              Asientos requeridos:
            </span>
            <span className="text-sm font-extrabold text-[#ff6700]">
              {selectedSeats.length} de {passengerCount} {passengerCount === 1 ? "seleccionado" : "seleccionados"}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3">
          <Loader2 className="w-10 h-10 text-[#ff6700] animate-spin mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">Consultando mapa de asientos en el GDS...</h3>
          <p className="text-xs text-slate-400">Endpoint: POST /buses/seat-map con token de viaje oficial</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-rose-900 text-sm">Error al cargar mapa de asientos</h4>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Seatmap Bus Visualizer */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Paraderos de subida y bajada devueltos por el GDS */}
            {seatmap?.stops && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Terminal de Subida (GDS):
                  </label>
                  <select
                    value={selectedSubida}
                    onChange={(e) => setSelectedSubida(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    {seatmap.stops.subida?.map((st) => (
                      <option key={st.name} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Terminal de Bajada (GDS):
                  </label>
                  <select
                    value={selectedBajada}
                    onChange={(e) => setSelectedBajada(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    {seatmap.stops.bajada?.map((st) => (
                      <option key={st.name} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Floor selector if multi-deck */}
            {(seatmap?.floors || 1) > 1 && (
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#ff6700]" />
                  Seleccionar Nivel del Bus:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveFloor(1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFloor === 1
                        ? "bg-[#023caf] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Piso 1 ({currentFloorSeats[0]?.type || "Salón Cama"})
                  </button>
                  <button
                    onClick={() => setActiveFloor(2)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFloor === 2
                        ? "bg-[#023caf] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Piso 2
                  </button>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-white border-2 border-emerald-500 shadow-2xs"></div>
                <span className="text-slate-600 font-medium">Disponible ({formatCLP(service.price)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#ff6700] text-white flex items-center justify-center font-bold text-[10px]">
                  ✓
                </div>
                <span className="text-slate-800 font-bold">Seleccionado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-slate-300 border border-slate-300"></div>
                <span className="text-slate-400 font-medium">Ocupado</span>
              </div>
            </div>

            {/* Bus Shell Container */}
            <div className="max-w-md mx-auto bg-slate-100 border-2 border-slate-300 rounded-3xl p-6 shadow-inner relative">
              {/* Bus Windshield / Front */}
              <div className="border-b-2 border-dashed border-slate-300 pb-4 mb-6 text-center">
                <div className="w-24 h-4 bg-slate-200 rounded-full mx-auto mb-2"></div>
                <div className="flex items-center justify-between px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>Conductor 🚌</span>
                  <span>Puerta Delantera</span>
                </div>
              </div>

              {/* Rows of seats */}
              <div className="space-y-4">
                {sortedRowKeys.map((rowNum) => {
                  const rowSeats = rowsMap.get(rowNum) || [];
                  const isThreeCols = rowSeats.length <= 3;

                  return (
                    <div key={rowNum} className="flex items-center justify-between gap-3">
                      {/* Left side seats */}
                      <div className="flex gap-2">
                        {rowSeats.slice(0, isThreeCols ? 1 : 2).map((seat) => {
                          const isSelected = selectedSeats.some(
                            (s) => s.seat_number === seat.seat_number
                          );
                          const isOccupied = seat.status === "occupied";

                          return (
                            <button
                              key={seat.seat_number}
                              type="button"
                              disabled={isOccupied}
                              onClick={() => handleSeatClick(seat)}
                              className={`w-12 h-14 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all relative select-none ${
                                isOccupied
                                  ? "bg-slate-300 text-slate-400 cursor-not-allowed border border-slate-300"
                                  : isSelected
                                  ? "bg-[#ff6700] text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-300 scale-105"
                                  : "bg-white text-slate-800 border-2 border-emerald-500 hover:border-emerald-600 hover:bg-emerald-50/50 shadow-xs"
                              }`}
                            >
                              <Armchair className="w-4 h-4 mb-0.5 opacity-80" />
                              <span className="leading-none">{seat.seat_number}</span>
                              {isSelected && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Center Aisle */}
                      <div className="flex-1 text-center">
                        <span className="text-[10px] text-slate-300 font-mono">
                          • {rowNum} •
                        </span>
                      </div>

                      {/* Right side seats */}
                      <div className="flex gap-2">
                        {rowSeats.slice(isThreeCols ? 1 : 2).map((seat) => {
                          const isSelected = selectedSeats.some(
                            (s) => s.seat_number === seat.seat_number
                          );
                          const isOccupied = seat.status === "occupied";

                          return (
                            <button
                              key={seat.seat_number}
                              type="button"
                              disabled={isOccupied}
                              onClick={() => handleSeatClick(seat)}
                              className={`w-12 h-14 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all relative select-none ${
                                isOccupied
                                  ? "bg-slate-300 text-slate-400 cursor-not-allowed border border-slate-300"
                                  : isSelected
                                  ? "bg-[#ff6700] text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-300 scale-105"
                                  : "bg-white text-slate-800 border-2 border-emerald-500 hover:border-emerald-600 hover:bg-emerald-50/50 shadow-xs"
                              }`}
                            >
                              <Armchair className="w-4 h-4 mb-0.5 opacity-80" />
                              <span className="leading-none">{seat.seat_number}</span>
                              {isSelected && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bus Back */}
              <div className="border-t-2 border-dashed border-slate-300 mt-6 pt-4 flex items-center justify-between text-xs text-slate-400 px-4">
                <span>Baño 🚻</span>
                <span>Puerta Trasera</span>
              </div>
            </div>
          </div>

          {/* Sidebar Summary & CTA */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-900 text-base pb-3 border-b border-slate-100 flex items-center gap-2">
                <Armchair className="w-4 h-4 text-[#ff6700]" />
                <span>Resumen de Asientos GDS</span>
              </h3>

              {/* Selected seats list */}
              {selectedSeats.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Haz clic en los asientos verdes para seleccionarlos
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedSeats.map((seat) => (
                    <div
                      key={seat.seat_number}
                      className="flex items-center justify-between p-2.5 bg-orange-50/50 rounded-xl border border-orange-200/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-[#ff6700] text-white flex items-center justify-center font-bold">
                          {seat.seat_number}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">
                            Piso {seat.floor} • {seat.type}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate max-w-[130px]">
                            Token: {seat.idreserve.slice(0, 16)}...
                          </p>
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-900">
                        {formatCLP(seat.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Price total */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Total a pagar:</span>
                <span className="text-xl font-black text-[#ff6700]">
                  {formatCLP(totalAmount)}
                </span>
              </div>

              {/* Proceed Button */}
              <button
                type="button"
                disabled={!isSelectionComplete}
                onClick={() =>
                  onProceed(selectedSeats, {
                    subida: selectedSubida,
                    bajada: selectedBajada,
                  })
                }
                className="w-full py-3 rounded-xl font-bold text-sm bg-[#ff6700] hover:bg-[#e65c00] text-white shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Continuar a Pasajeros</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
