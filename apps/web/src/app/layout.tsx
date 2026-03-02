import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vacation Control",
  description: "Sistema profesional de gestión de vacaciones",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
