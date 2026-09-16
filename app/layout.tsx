import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wochenatelier · Schule Opfikon",
  description: "Übersichtliche Unterrichtsplanung für altersdurchmischte Klassen und Teamteaching.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
