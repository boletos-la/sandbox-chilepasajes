import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chilepasajes & Boletos.la — Compra y Gestión de Pasajes",
  description:
    "Plataforma completa de compra y anulación de pasajes de bus interurbanos en Chile conectada en tiempo real al GDS oficial de Enbus / Chilepasajes.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='14'>🚌</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-800 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

