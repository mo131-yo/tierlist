import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TmdbAttribution } from "@/components/TmdbAttribution";
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
