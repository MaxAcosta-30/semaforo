import type { Metadata } from "next";
import {
  Barlow_Condensed,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
} from "next/font/google";
import "./globals.css";

// next/font las sirve desde el mismo dominio: el navegador nunca llama a Google.
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--fuente-display",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-mono",
});

export const metadata: Metadata = {
  title: "Semáforo",
  description: "Saber si se puede liberar, antes de liberar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
