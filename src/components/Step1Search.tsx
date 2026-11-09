"use client";

import React, { useState, useEffect } from "react";
import {
  MapPin,
  Calendar,
  Users,
  Search,
  ArrowRightLeft,
  Clock,
  Bus,
  Wifi,
  Snowflake,
  Tv,
  Coffee,
  Plug,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ChevronRight,
  Filter,
  CalendarDays,
} from "lucide-react";
import type { LocationCity, BusService } from "../types";
import { fetchOrigins, fetchDestinations, searchServices } from "../services/api";
import { formatCLP } from "../utils/rut";

interface Step1SearchProps {
  onSelectService: (
    service: BusService,
    passengerCount: number,
    searchParams: { origin: LocationCity; destination: LocationCity; date: string }
  ) => void;
}

const amenityIcons: Record<string, React.ReactNode> = {
  WiFi: <Wifi className="w-3.5 h-3.5" />,
  "Aire Acondicionado": <Snowflake className="w-3.5 h-3.5" />,
  TV: <Tv className="w-3.5 h-3.5" />,
  Snack: <Coffee className="w-3.5 h-3.5" />,
  "Cargador USB": <Plug className="w-3.5 h-3.5" />,
  Baño: <Bus className="w-3.5 h-3.5" />,
};

export const Step1Search: React.FC<Step1SearchProps> = ({ onSelectService }) => {
  const [origins, setOrigins] = useState<LocationCity[]>([]);
  const [destinations, setDestinations] = useState<LocationCity[]>([]);
  const [selectedOriginName, setSelectedOriginName] = useState<string>("Santiago");
  const [selectedDestName, setSelectedDestName] = useState<string>("Valdivia");

  // Fecha predeterminada de salida (mañana: 2026-11-10 para asegurar servicios en QA)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split("T")[0];
  const [departureDate, setDepartureDate] = useState<string>(defaultDateStr);

  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [loadingOrigins, setLoadingOrigins] = useState(true);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [searching, setSearching] = useState(false);
  const [services, setServices] = useState<BusService[]>([]);
  const [nearbyDates, setNearbyDates] = useState<Array<{ date: string; date_text: string; price: number }>>([]);
  const [searchDone, setSearchDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"time" | "price_asc" | "price_desc">("time");

  // 1. Cargar orígenes reales desde el GDS al montar
  useEffect(() => {
    async function loadOrigins() {
      try {
        setLoadingOrigins(true);
        setError(null);
        const list = await fetchOrigins();
        setOrigins(list);

        if (list.length > 0) {
          const santiago = list.find((o) => o.name.toLowerCase() === "santiago");
          const initOrigin = santiago ? santiago.name : list[0].name;
          setSelectedOriginName(initOrigin);
        }
      } catch (err: any) {
        setError("Error al consultar catálogo de orígenes del GDS: " + err.message);
      } finally {
        setLoadingOrigins(false);
      }
    }
    loadOrigins();
  }, []);

  // 2. Cargar destinos reales para el origen seleccionado
  useEffect(() => {
    async function loadDests() {
      if (!selectedOriginName) return;
      try {
        setLoadingDestinations(true);
        const dests = await fetchDestinations(selectedOriginName);
        setDestinations(dests);

        if (dests.length > 0) {
          // Si el destino actual no existe en el nuevo origen, seleccionar uno preferente o el primero
          const hasValdivia = dests.some((d) => d.name.toLowerCase() === "valdivia");
          if (hasValdivia) {
            setSelectedDestName("Valdivia");
          } else if (!dests.some((d) => d.name.toLowerCase() === selectedDestName.toLowerCase())) {
            setSelectedDestName(dests[0].name);
          }
        } else {
          setSelectedDestName("");
        }
      } catch (err: any) {
        console.error("Error al cargar destinos del GDS:", err);
      } finally {
        setLoadingDestinations(false);
      }
    }
    loadDests();
  }, [selectedOriginName]);

  // 3. Auto-búsqueda inicial cuando se tengan orígenes y destinos listos
  useEffect(() => {
    if (origins.length > 0 && destinations.length > 0 && !searchDone) {
      executeSearch(selectedOriginName, selectedDestName, departureDate);
    }
  }, [origins, destinations]);

  const handleSwap = () => {
    const temp = selectedOriginName;
    setSelectedOriginName(selectedDestName);
    setSelectedDestName(temp);
  };

  const executeSearch = async (origin: string, dest: string, date: string) => {
    if (!origin || !dest || !date) return;
    setError(null);
    setSearching(true);
    setSearchDone(true);

    try {
      const res = await searchServices(origin, dest, date);
      setServices(res.services);
      setNearbyDates(res.nearby_dates);
    } catch (err: any) {
      setError("Error devuelto por la API del GDS: " + err.message);
      setServices([]);
      setNearbyDates([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(selectedOriginName, selectedDestName, departureDate);
  };

  const currentOriginObj = origins.find(
    (o) => o.name.toLowerCase() === selectedOriginName.toLowerCase()
  ) || {
    id: 1,
    name: selectedOriginName,
    search_name: selectedOriginName.toLowerCase(),
    region: "Chile",
  };

  const currentDestObj = destinations.find(
    (d) => d.name.toLowerCase() === selectedDestName.toLowerCase()
  ) || {
    id: 2,
    name: selectedDestName,
    search_name: selectedDestName.toLowerCase(),
    region: "Chile",
  };

  // Filtrado y ordenamiento de servicios devueltos por el GDS
  const filteredServices = services
    .filter((s) => {
      if (filterClass === "ALL") return true;
      return s.seat_classes.some((c) =>
        c.type.toLowerCase().includes(filterClass.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") {
        return a.price - b.price;
      }
      if (sortBy === "price_desc") {
        return b.price - a.price;
      }
      return (a.departs_at_hour || a.departure_time).localeCompare(
        b.departs_at_hour || b.departure_time
      );
    });

  return (
    <div className="space-y-6">
      {/* Search Bar Widget */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Buscar Pasajes de Bus en Chile (GDS Enbus)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Datos 100% en vivo del GDS: tarifas, asientos e itinerarios sin valores simulados
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>GDS Conectado: back-qas.enbus.cl</span>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Origen */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#ff6700]" />
                <span>Origen (Catálogo GDS)</span>
              </label>
              <div className="relative">
                <select
                  value={selectedOriginName}
                  onChange={(e) => setSelectedOriginName(e.target.value)}
                  disabled={loadingOrigins}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] focus:border-transparent outline-none transition-all"
                >
                  {loadingOrigins ? (
                    <option>Consultando orígenes GDS...</option>
                  ) : origins.length === 0 ? (
                    <option>Sin orígenes disponibles</option>
                  ) : (
                    origins.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Swap Button */}
            <div className="md:col-span-1 flex justify-center -my-1 md:my-0">
              <button
                type="button"
                onClick={handleSwap}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#ff6700] hover:text-white text-slate-600 flex items-center justify-center transition-colors shadow-2xs border border-slate-200"
                title="Invertir origen y destino"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Destino */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#023caf]" />
                <span>Destino (Tramos GDS)</span>
              </label>
              <div className="relative">
                <select
                  value={selectedDestName}
                  onChange={(e) => setSelectedDestName(e.target.value)}
                  disabled={loadingDestinations}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] focus:border-transparent outline-none transition-all"
                >
                  {loadingDestinations ? (
                    <option>Consultando tramos GDS...</option>
                  ) : destinations.length === 0 ? (
                    <option>Sin destinos asociados para este origen</option>
                  ) : (
                    destinations.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Fecha de Salida */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#ff6700]" />
                <span>Fecha de Ida</span>
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            {/* Pasajeros */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-600" />
                <span>Pasajeros</span>
              </label>
              <select
                value={passengerCount}
                onChange={(e) => setPassengerCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#ff6700] focus:border-transparent outline-none transition-all"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "pasajero" : "pasajeros"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {/* Rutas activas en el GDS */}
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700">Rutas activas en QA:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedOriginName("Santiago");
                  setSelectedDestName("Valdivia");
                  executeSearch("Santiago", "Valdivia", departureDate);
                }}
                className="font-bold text-[#ff6700] hover:underline bg-orange-50 px-2 py-0.5 rounded border border-orange-200"
              >
                Santiago → Valdivia (7 salidas)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOriginName("Santiago");
                  setSelectedDestName("Nueva Imperial");
                  executeSearch("Santiago", "Nueva Imperial", departureDate);
                }}
                className="underline hover:text-[#ff6700]"
              >
                Santiago → Nueva Imperial
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOriginName("Santiago");
                  setSelectedDestName("Labranza");
                  executeSearch("Santiago", "Labranza", departureDate);
                }}
                className="underline hover:text-[#ff6700]"
              >
                Santiago → Labranza
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOriginName("Santiago");
                  setSelectedDestName("Carahue");
                  executeSearch("Santiago", "Carahue", departureDate);
                }}
                className="underline hover:text-[#ff6700]"
              >
                Santiago → Carahue
              </button>
            </div>

            <button
              type="submit"
              disabled={searching}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm bg-[#ff6700] hover:bg-[#e65c00] text-white shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consultando GDS...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar en GDS</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Respuesta de error de la API del GDS</h4>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {searchDone && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-900">
                  {selectedOriginName} → {selectedDestName}
                </span>
                <span className="bg-orange-50 text-[#ff6700] border border-orange-200 text-xs font-bold px-2 py-0.5 rounded-full">
                  {filteredServices.length} {filteredServices.length === 1 ? "servicio real" : "servicios reales"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Fecha: {departureDate} • {passengerCount} {passengerCount === 1 ? "pasajero" : "pasajeros"}
              </p>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 outline-none"
                >
                  <option value="ALL">Todas las clases</option>
                  <option value="SALON CAMA">Salón Cama</option>
                  <option value="SEMI CAMA">Semi Cama</option>
                  <option value="PREMIUM">Premium</option>
                </select>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 outline-none"
              >
                <option value="time">Por horario</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
              </select>
            </div>
          </div>

          {/* List of Services */}
          {searching ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#ff6700] animate-spin mx-auto" />
              <p className="font-bold text-slate-700 text-sm">Consultando itinerarios en el GDS...</p>
              <p className="text-xs text-slate-400">Endpoint: /buses/schedules con API-Key sk_test_...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4">
              <Bus className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Sin servicios programados en el GDS para {selectedOriginName} → {selectedDestName} en {departureDate}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  El GDS no tiene itinerarios habilitados para esta fecha en el ambiente de QA. Puedes probar con la ruta activa <strong>Santiago → Valdivia</strong> o seleccionar una fecha cercana.
                </p>
              </div>

              {/* Fechas cercanas devueltas por el GDS */}
              {nearbyDates.length > 0 && (
                <div className="pt-3 border-t border-slate-100 max-w-2xl mx-auto">
                  <span className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 mb-2.5">
                    <CalendarDays className="w-4 h-4 text-[#ff6700]" />
                    <span>Fechas sugeridas por el GDS:</span>
                  </span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {nearbyDates.slice(0, 7).map((nd) => {
                      const isoDate = nd.date.split("T")[0];
                      return (
                        <button
                          key={nd.date}
                          type="button"
                          onClick={() => {
                            setDepartureDate(isoDate);
                            executeSearch(selectedOriginName, selectedDestName, isoDate);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-xs text-slate-700 font-medium transition-colors"
                        >
                          <span className="block font-bold">{nd.date_text}</span>
                          {nd.price > 0 && (
                            <span className="text-[10px] text-[#ff6700] font-bold">
                              Desde {formatCLP(nd.price)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServices.map((service) => {
                const depTime =
                  service.departs_at_hour ||
                  (service.departure_time.includes("T")
                    ? service.departure_time.split("T")[1].slice(0, 5)
                    : service.departure_time);
                const arrTime =
                  service.arrives_at_hour ||
                  (service.arrival_time.includes("T")
                    ? service.arrival_time.split("T")[1].slice(0, 5)
                    : service.arrival_time);

                return (
                  <div
                    key={service.service_id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-[#ff6700]/50 hover:shadow-md transition-all group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Operator & Route details */}
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          {service.operator_logo ? (
                            <img
                              src={service.operator_logo}
                              alt={service.operator_name}
                              className="w-10 h-10 object-contain rounded-lg p-1 bg-white border border-slate-200"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-[#023caf] font-bold text-xs border border-slate-200">
                              <Bus className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 text-sm">
                              {service.operator_name}
                            </span>
                            <span className="ml-2 text-[11px] font-mono text-slate-400">
                              ID GDS: {service.service_id}
                            </span>
                          </div>
                        </div>

                        {/* Schedule Times Row */}
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div>
                            <p className="text-2xl font-black text-slate-900 leading-none">
                              {depTime}
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-1 truncate max-w-[140px] sm:max-w-[180px]">
                              {service.origin_terminal}
                            </p>
                          </div>

                          <div className="flex-1 max-w-[140px] flex flex-col items-center">
                            <span className="text-[11px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {service.duration || "Directo"}
                            </span>
                            <div className="w-full flex items-center">
                              <div className="h-0.5 bg-slate-200 flex-1"></div>
                              <ChevronRight className="w-4 h-4 text-slate-400 -mx-1" />
                              <div className="h-0.5 bg-slate-200 flex-1"></div>
                            </div>
                            <span className="text-[10px] text-emerald-600 font-bold mt-1">
                              Directo GDS
                            </span>
                          </div>

                          <div>
                            <p className="text-2xl font-black text-slate-900 leading-none">
                              {arrTime}
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-1 truncate max-w-[140px] sm:max-w-[180px]">
                              {service.destination_terminal}
                            </p>
                          </div>
                        </div>

                        {/* Amenities */}
                        {service.amenities.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 flex-wrap">
                            {service.amenities.map((am) => (
                              <span
                                key={am}
                                className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-[11px]"
                              >
                                {amenityIcons[am] || <Bus className="w-3 h-3" />}
                                <span>{am}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Seat Classes & Select Action */}
                      <div className="lg:border-l lg:border-slate-100 lg:pl-6 flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 shrink-0">
                        {/* Classes pills */}
                        <div className="flex flex-wrap lg:flex-col gap-2">
                          {service.seat_classes.map((cls) => (
                            <div
                              key={cls.type}
                              className="text-left lg:text-right bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5"
                            >
                              <div className="flex items-center lg:justify-end gap-1.5">
                                <span className="font-bold text-xs text-slate-800">
                                  {cls.type}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                                    cls.available_seats > 0
                                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                      : "text-slate-400 bg-slate-100 border-slate-200"
                                  }`}
                                >
                                  {cls.available_seats > 0
                                    ? `${cls.available_seats} libres`
                                    : "Agotado"}
                                </span>
                              </div>
                              <p className="text-sm font-extrabold text-[#ff6700] leading-tight">
                                {formatCLP(cls.price)}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Choose seats CTA */}
                        <button
                          disabled={service.available_seats <= 0}
                          onClick={() =>
                            onSelectService(service, passengerCount, {
                              origin: currentOriginObj,
                              destination: currentDestObj,
                              date: departureDate,
                            })
                          }
                          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                            service.available_seats > 0
                              ? "bg-[#ff6700] hover:bg-[#e65c00] text-white shadow-md shadow-orange-500/20 group-hover:scale-105"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                          }`}
                        >
                          {service.available_seats > 0 ? (
                            <>
                              <span>Elegir Asientos ({service.available_seats} disp.)</span>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          ) : (
                            <span>Agotado en GDS</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
