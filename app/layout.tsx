import type { Metadata, Viewport } from "next";
import "./globals.css";

import { PwaSetup } from "@/components/planner/pwa-setup";

const basePath = process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon" : "";

export const metadata: Metadata = {
  title: "Wochenatelier · Schule Opfikon",
  description: "Übersichtliche Unterrichtsplanung für altersdurchmischte Klassen und Teamteaching.",
  applicationName: "Wochenatelier",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
    apple: `${basePath}/icons/icon-192.png`,
  },
  appleWebApp: { capable: true, title: "Wochenatelier", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b4a7e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
