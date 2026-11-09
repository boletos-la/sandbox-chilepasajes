import React, { useState, useEffect } from "react";
import {
  Activity,
  X,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Code2,
  Copy,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import type { ApiLogEntry, ApiConfig } from "../types";
import {
  subscribeApiLogs,
  clearApiLogs,
  getApiConfig,
  saveApiConfig,
  DEFAULT_CONFIG,
} from "../services/api";

interface ApiInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiInspectorModal: React.FC<ApiInspectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "settings">("logs");

  // Config editor state
  const [config, setConfig] = useState<ApiConfig>(getApiConfig());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeApiLogs((newLogs) => {
      setLogs(newLogs);
      if (newLogs.length > 0 && !selectedLog) {
        setSelectedLog(newLogs[0]);
      }
    });

    return () => unsubscribe();
  }, [selectedLog]);

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveApiConfig(config);
    setSaveMessage("¡Configuración guardada exitosamente!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    saveApiConfig(DEFAULT_CONFIG);
    setSaveMessage("Restaurada a configuración predeterminada.");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleTestConnection = async () => {
    setPingLoading(true);
    setPingStatus(null);
    try {
      const cleanBase = config.baseUrl.replace(/\/+$/, "");
      const res = await fetch(`${cleanBase}/buses/get-cities?complement=pasajes`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPingStatus(`✓ Conexión exitosa a ${cleanBase} (HTTP ${res.status}). Encontradas ${data.response?.cities?.length || 0} ciudades.`);
      } else {
        setPingStatus(`⚠️ Respuesta del servidor: HTTP ${res.status}. Mensaje: ${data.message || data.response?.message || 'Error'}`);
      }
    } catch (err: any) {
      setPingStatus(`✕ Error de conexión o red: ${err.message}`);
    } finally {
      setPingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  Inspector de Red y API (fetch)
                </h3>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Bearer Auth
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Monitoreo en tiempo real de llamadas HTTP fetch y configuración del host
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === "logs"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Peticiones ({logs.length})
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === "settings"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Configurar Host
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab 1: Logs & Network details */}
        {activeTab === "logs" && (
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
            {/* Left Column: Request List */}
            <div className="md:col-span-5 border-r border-slate-800 flex flex-col overflow-hidden bg-slate-900/50">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Historial de peticiones</span>
                {logs.length > 0 && (
                  <button
                    onClick={clearApiLogs}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                    <Activity className="w-8 h-8 mx-auto text-slate-700" />
                    <p>No se han registrado peticiones aún.</p>
                    <p className="text-[11px] text-slate-600">
                      Realiza una búsqueda de pasajes o reserva para ver el tráfico en vivo.
                    </p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    const isSuccess = log.status >= 200 && log.status < 300;

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`p-3 text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-slate-800/90 border-l-4 border-l-[#ff6700]"
                            : "hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`font-black text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              log.method === "POST"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {log.method}
                          </span>

                          <span
                            className={`font-mono text-[11px] font-bold ${
                              isSuccess ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {log.status} {log.durationMs}ms
                          </span>
                        </div>

                        <p className="font-mono text-slate-300 text-[11px] truncate">
                          {log.url.replace(/^https?:\/\/[^\/]+/, "")}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>{log.timestamp.split("T")[1]?.slice(0, 8)}</span>
                          {log.isMockFallback && (
                            <span className="text-amber-400/90 font-semibold bg-amber-400/10 px-1 rounded">
                              fallback doc
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Log Details */}
            <div className="md:col-span-7 flex flex-col overflow-hidden bg-slate-950 p-5 space-y-4">
              {selectedLog ? (
                <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                  {/* General info */}
                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 font-mono font-bold text-xs text-white">
                        {selectedLog.method}
                      </span>
                      <span className="font-mono text-xs text-emerald-400 break-all">
                        {selectedLog.url}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>Status: <strong className="text-white">{selectedLog.status}</strong></span>
                      <span>Duración: <strong className="text-white">{selectedLog.durationMs} ms</strong></span>
                      <span>Hora: {selectedLog.timestamp}</span>
                    </div>
                  </div>

                  {/* Headers */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-1 flex items-center justify-between">
                      <span>Request Headers:</span>
                      <span className="text-[10px] text-emerald-400">Bearer Token Autenticado</span>
                    </h4>
                    <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(selectedLog.headers, null, 2)}
                    </pre>
                  </div>

                  {/* Request Body (if POST) */}
                  {selectedLog.body && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 mb-1">Request Body (JSON):</h4>
                      <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-amber-300 overflow-x-auto">
                        {JSON.stringify(selectedLog.body, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Response Body */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-1">Response Body:</h4>
                    <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-80">
                      {JSON.stringify(selectedLog.responseBody, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Selecciona una petición del listado para inspeccionar sus encabezados y respuestas
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Settings */}
        {activeTab === "settings" && (
          <div className="p-6 overflow-y-auto max-w-2xl mx-auto w-full space-y-6">
            <div>
              <h4 className="text-lg font-black text-white">
                Configuración del Servidor y Credenciales
              </h4>
              <p className="text-xs text-slate-400">
                Personaliza el host y la API-Key utilizados por todas las llamadas fetch.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Base URL del Host Enbus / Chilepasajes:
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="https://back-qas.enbus.cl/api/v1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:ring-2 focus:ring-[#ff6700] outline-none"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Predeterminado: <code className="text-slate-400 font-mono">https://back-qas.enbus.cl/api/v1</code> (o <code className="text-slate-400 font-mono">https://back-qas.enbus.cl/api/v</code>)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  API Key QA (Bearer Token):
                </label>
                <input
                  type="text"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="sk_test_FtC48QXZHlbvE"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:ring-2 focus:ring-[#ff6700] outline-none"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Token entregado para QA: <code className="text-slate-400 font-mono">sk_test_FtC48QXZHlbvE</code>
                </span>
              </div>

              {saveMessage && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{saveMessage}</span>
                </div>
              )}

              {/* Test connection results */}
              {pingStatus && (
                <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl text-xs text-slate-300 font-mono">
                  {pingStatus}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={pingLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${pingLoading ? "animate-spin" : ""}`} />
                  <span>Probar Conexión en Vivo</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="px-4 py-2 bg-transparent text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Restaurar
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#ff6700] hover:bg-[#e65c00] text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
