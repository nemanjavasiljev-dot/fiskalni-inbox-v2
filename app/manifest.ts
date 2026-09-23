import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FiscalBox",
    short_name: "FiscalBox",
    description: "Skeniraj. Sačuvaj. Pošalji knjigovođi. Aplikacija za fiskalne račune i dokumenta.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#F6F8F3",
    theme_color: "#0D382B",
    orientation: "any",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
