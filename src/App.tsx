import React, { useState } from "react";
import { Header } from "./components/Header";
import { BookingProgress } from "./components/BookingProgress";
import { Step1Search } from "./components/Step1Search";
import { Step2Seatmap } from "./components/Step2Seatmap";
import { Step3Passengers } from "./components/Step3Passengers";
import { Step4HoldAndPay } from "./components/Step4HoldAndPay";
import { Step5Confirmation } from "./components/Step5Confirmation";
import { AnularBoletoSection } from "./components/AnularBoletoSection";
import { ApiInspectorModal } from "./components/ApiInspectorModal";
import { MyTicketsModal } from "./components/MyTicketsModal";
import type {
  BusService,
  Seat,
  LocationCity,
  BuyerData,
  PassengerData,
  IssuedTicket,
} from "./types";
import { Bus, ShieldCheck, Heart, Terminal } from "lucide-react";

export function App() {
  const [activeTab, setActiveTab] = useState<"booking" | "cancel" | "my-tickets">("booking");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [sessionUuid, setSessionUuid] = useState<string>(() => crypto.randomUUID());

  // Booking Flow State
  const [selectedService, setSelectedService] = useState<BusService | null>(null);
  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [searchParams, setSearchParams] = useState<{
    origin: LocationCity;
    destination: LocationCity;
    date: string;
  } | null>(null);

  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [selectedStops, setSelectedStops] = useState<{ subida?: string; bajada?: string } | undefined>(undefined);
  const [buyerData, setBuyerData] = useState<BuyerData | null>(null);
  const [passengersData, setPassengersData] = useState<PassengerData[]>([]);
  const [issuedTicket, setIssuedTicket] = useState<IssuedTicket | null>(null);

  // Pre-fill for Anular tab
  const [cancelTicketCode, setCancelTicketCode] = useState<string>("");
  const [cancelTicketRut, setCancelTicketRut] = useState<string>("");

  // Modals
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isMyTicketsOpen, setIsMyTicketsOpen] = useState<boolean>(false);

  // Step 1: Service Chosen
  const handleSelectService = (
    service: BusService,
    count: number,
    params: { origin: LocationCity; destination: LocationCity; date: string }
  ) => {
    setSessionUuid(crypto.randomUUID()); // Sesión de compra única para todo el ciclo de reserva en GDS
    setSelectedService(service);
    setPassengerCount(count);
    setSearchParams(params);
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 2: Seats Chosen
  const handleSeatsChosen = (seats: Seat[], stops?: { subida?: string; bajada?: string }) => {
    setSelectedSeats(seats);
    setSelectedStops(stops);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 3: Passengers Filled
  const handlePassengersFilled = (buyer: BuyerData, passengers: PassengerData[]) => {
    setBuyerData(buyer);
    setPassengersData(passengers);
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 4: Reservation & Payment Confirmed
  const handleBookingSuccess = (ticket: IssuedTicket) => {
    setIssuedTicket(ticket);
    setCurrentStep(5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 5: Start new search
  const handleResetFlow = () => {
    setSessionUuid(crypto.randomUUID());
    setSelectedService(null);
    setSelectedSeats([]);
    setSelectedStops(undefined);
    setBuyerData(null);
    setPassengersData([]);
    setIssuedTicket(null);
    setCurrentStep(1);
    setActiveTab("booking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Trigger Cancel from anywhere (e.g., ticket confirmation or modal)
  const handleTriggerCancel = (ticketCode: string, rut?: string) => {
    setCancelTicketCode(ticketCode);
    setCancelTicketRut(rut || "");
    setActiveTab("cancel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "my-tickets") {
            setIsMyTicketsOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onOpenInspector={() => setIsInspectorOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 pb-16">
        {activeTab === "booking" && (
          <>
            {/* Step Progress Bar */}
            <BookingProgress
              currentStep={currentStep}
              onStepClick={(step) => {
                if (step < currentStep) setCurrentStep(step);
              }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
              {/* Step 1: Search */}
              {currentStep === 1 && (
                <Step1Search onSelectService={handleSelectService} />
              )}

              {/* Step 2: Seat Selection */}
              {currentStep === 2 && selectedService && searchParams && (
                <Step2Seatmap
                  service={selectedService}
                  passengerCount={passengerCount}
                  searchParams={searchParams}
                  sessionUuid={sessionUuid}
                  onProceed={handleSeatsChosen}
                  onBack={() => setCurrentStep(1)}
                />
              )}

              {/* Step 3: Passengers Form */}
              {currentStep === 3 && selectedService && searchParams && (
                <Step3Passengers
                  service={selectedService}
                  selectedSeats={selectedSeats}
                  searchParams={searchParams}
                  stops={selectedStops}
                  onProceed={handlePassengersFilled}
                  onBack={() => setCurrentStep(2)}
                />
              )}

              {/* Step 4: Hold & Payment */}
              {currentStep === 4 && selectedService && searchParams && buyerData && (
                <Step4HoldAndPay
                  service={selectedService}
                  selectedSeats={selectedSeats}
                  buyer={buyerData}
                  passengers={passengersData}
                  searchParams={searchParams}
                  sessionUuid={sessionUuid}
                  onSuccess={handleBookingSuccess}
                  onBack={() => setCurrentStep(2)}
                />
              )}

              {/* Step 5: E-Ticket Confirmation */}
              {currentStep === 5 && issuedTicket && (
                <Step5Confirmation
                  ticket={issuedTicket}
                  onNewSearch={handleResetFlow}
                  onCancelTicket={handleTriggerCancel}
                />
              )}
            </div>
          </>
        )}

        {/* Tab: Anular Boleto */}
        {activeTab === "cancel" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
            <AnularBoletoSection
              initialTicketCode={cancelTicketCode}
              initialRut={cancelTicketRut}
              onGoToBuy={handleResetFlow}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <ApiInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      <MyTicketsModal
        isOpen={isMyTicketsOpen}
        onClose={() => setIsMyTicketsOpen(false)}
        onSelectTicket={(ticket) => {
          setIssuedTicket(ticket);
          setActiveTab("booking");
          setCurrentStep(5);
        }}
        onCancelTicket={handleTriggerCancel}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">Chilepasajes / Enbus</span>
            <span>•</span>
            <span>Flujo de Compra y Post-Venta 100% Chile</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>API REST Host: back-qas.enbus.cl</span>
            <span>•</span>
            <button
              onClick={() => setIsInspectorOpen(true)}
              className="text-[#ff6700] hover:underline font-semibold"
            >
              Inspeccionar llamadas fetch
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
