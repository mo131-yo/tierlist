import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CineTier — Кино/Аниме Tier List",
    short_name: "CineTier",
    description:
      "Кино, аниме, сериалаа хайгаад шууд tier list хий — poster автоматаар татагдана.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    // globals.css-ийн .dark --background: oklch(0.13 0.012 270)
    background_color: "#06070c",
    theme_color: "#06070c",
    lang: "mn",
    categories: ["entertainment", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
