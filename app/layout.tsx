import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon" : "";

export const metadata: Metadata = {
  title: "Wochenatelier · Schule Opfikon",
  description: "Übersichtliche Unterrichtsplanung für altersdurchmischte Klassen und Teamteaching.",
  icons: { icon: `${basePath}/favicon.svg`, shortcut: `${basePath}/favicon.svg` },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
