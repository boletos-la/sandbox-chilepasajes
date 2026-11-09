"use client";

import React from "react";
import { Check, Search, Armchair, UserCheck, CreditCard, Ticket } from "lucide-react";

interface BookingProgressProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const STEPS = [
  { step: 1, label: "Buscar Servicios", icon: Search },
  { step: 2, label: "Elegir Asientos", icon: Armchair },
  { step: 3, label: "Datos Pasajeros", icon: UserCheck },
  { step: 4, label: "Reserva y Pago", icon: CreditCard },
  { step: 5, label: "Boleto Emitido", icon: Ticket },
];

export const BookingProgress: React.FC<BookingProgressProps> = ({
  currentStep,
  onStepClick,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200 py-3 px-4 shadow-2xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {STEPS.map((s, idx) => {
          const isDone = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          const Icon = s.icon;
          const canClick = isDone && onStepClick;

          return (
            <React.Fragment key={s.step}>
              <div
                onClick={() => canClick && onStepClick(s.step)}
                className={`flex items-center gap-2 select-none ${
                  canClick ? "cursor-pointer group" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isDone
                      ? "bg-emerald-600 text-white shadow-xs"
                      : isCurrent
                      ? "bg-[#ff6700] text-white ring-4 ring-orange-100 shadow-xs"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="hidden sm:block text-left">
                  <p
                    className={`text-xs font-bold leading-tight ${
                      isCurrent
                        ? "text-[#ff6700]"
                        : isDone
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    Paso {s.step}
                  </p>
                  <p
                    className={`text-[11px] font-medium leading-none ${
                      isCurrent
                        ? "text-slate-900 font-bold"
                        : isDone
                        ? "text-slate-600"
                        : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
              </div>

              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-4 h-0.5 bg-slate-200 relative overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      currentStep > s.step ? "bg-emerald-500 w-full" : "w-0"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

