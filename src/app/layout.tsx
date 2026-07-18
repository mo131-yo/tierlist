import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TmdbAttribution } from "@/components/TmdbAttribution";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineTier — Кино/Аниме Tier List",
  description:
    "Кино, аниме, сериалаа хайгаад шууд tier list хий — poster автоматаар татагдана.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CineTier",
  },
  other: {
    // Next нь mobile-web-app-capable гаргадаг; хуучин iOS Safari-д apple- prefix хэрэгтэй
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  // globals.css-ийн .dark --background: oklch(0.13 0.012 270)
  themeColor: "#06070c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-bg min-h-full flex flex-col text-foreground">
        <RegisterServiceWorker />
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="shrink-0 border-t border-white/5 px-6 py-3 flex items-center justify-between text-xs text-muted-foreground/70">
          <span>CineTier</span>
          <TmdbAttribution />
        </footer>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
