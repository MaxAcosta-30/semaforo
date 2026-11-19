import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Semáforo",
  description: "Saber si se puede liberar, antes de liberar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
