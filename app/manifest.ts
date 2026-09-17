import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Wird beim Build nach /manifest.webmanifest exportiert; Pfade respektieren den basePath auf GitHub Pages.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${basePath}/`,
    name: "Wochenatelier · Unterrichtsplanung",
    short_name: "Wochenatelier",
    description: "Gemeinsam Unterricht planen – für altersdurchmischte Klassen und Teamteaching.",
    lang: "de-CH",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#f4f7fb",
    theme_color: "#0b4a7e",
    icons: [
      { src: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/icon-512-maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
