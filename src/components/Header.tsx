"use client";

import React, { useState, useEffect } from "react";
import { Bus, RotateCcw, Ticket, Terminal, Activity, CheckCircle2 } from "lucide-react";
import { getApiConfig, getSavedTickets, subscribeApiLogs } from "../services/api";

interface HeaderProps {
  activeTab: "booking" | "cancel" | "my-tickets";
  onTabChange: (tab: "booking" | "cancel" | "my-tickets") => void;
  onOpenInspector: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenInspector,
}) => {
  const [config, setConfig] = useState(getApiConfig());
  const [ticketCount, setTicketCount] = useState(0);
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      setConfig(getApiConfig());
      setTicketCount(getSavedTickets().length);
    };
    updateStats();

    window.addEventListener("chilepasajes_config_changed", updateStats);
    const unsubscribe = subscribeApiLogs((logs) => setLogCount(logs.length));

    return () => {
      window.removeEventListener("chilepasajes_config_changed", updateStats);
      unsubscribe();
    };
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Banner QA Environment */}
      <div className="bg-[#023caf] text-white text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold tracking-wide">ENTORNO QA CHILEPASAJES / ENBUS</span>
          <span className="text-blue-200 hidden md:inline">|</span>
          <span className="text-blue-100 hidden md:inline font-mono truncate">
            Host: {config.baseUrl}
          </span>
          <span className="ml-auto flex items-center gap-2 text-xs bg-white/10 px-2 py-0.5 rounded">
            <span className="text-emerald-300 font-medium">Bearer:</span>
            <span className="font-mono text-[11px] text-white/90">
              {config.apiKey.slice(0, 7)}...{config.apiKey.slice(-4)}
            </span>
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => onTabChange("booking")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6700] to-[#e65c00] flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xl tracking-tight text-slate-900">
                Chile<span className="text-[#ff6700]">pasajes</span>
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase border border-slate-200">
                Front
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Integración Oficial API REST Enbus & Boletos.la
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => onTabChange("booking")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "booking"
                ? "bg-white text-slate-900 shadow-xs text-[#023caf]"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Bus className="w-4 h-4 text-[#ff6700]" />
            <span>Comprar Pasaje</span>
          </button>

          <button
            onClick={() => onTabChange("cancel")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "cancel"
                ? "bg-white text-slate-900 shadow-xs text-rose-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <RotateCcw className="w-4 h-4 text-rose-500" />
            <span>Anular Boleto</span>
          </button>

          <button
            onClick={() => onTabChange("my-tickets")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "my-tickets"
                ? "bg-white text-slate-900 shadow-xs text-indigo-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Ticket className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">Mis Boletos</span>
            {ticketCount > 0 && (
              <span className="bg-[#ff6700] text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-5 text-center">
                {ticketCount}
              </span>
            )}
          </button>
        </nav>

        {/* Action Controls: API Inspector */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenInspector}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-100 hover:bg-slate-800 transition-colors shadow-xs group"
            title="Ver peticiones fetch en vivo y configurar API"
          >
            <Activity className="w-4 h-4 text-emerald-400 group-hover:animate-pulse" />
            <span className="hidden sm:inline">Inspector API (fetch)</span>
            {logCount > 0 && (
              <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30">
                {logCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

