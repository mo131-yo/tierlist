"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Film,
  Tv,
  Clapperboard,
  Sparkles,
  BookText,
  User,
  BookOpen,
  Globe,
  Layers,
  ImageIcon,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBackdropUrl, getPosterUrl } from "@/lib/imageStore";
import { sourceOfItemId, type MediaItem } from "@/lib/types";

// mediaType → монгол label + icon (QuickView мөн ашиглана)
export const TYPE_INFO: Record<string, { label: string; Icon: LucideIcon }> = {
  movie: { label: "Кино", Icon: Film },
  tv: { label: "Сериал", Icon: Tv },
  season: { label: "Улирал", Icon: Layers },
  anime: { label: "Аниме", Icon: Sparkles },
  manga: { label: "Манга", Icon: BookText },
  character: { label: "Дүр", Icon: User },
  book: { label: "Ном", Icon: BookOpen },
  wiki: { label: "Wikipedia", Icon: Globe },
  custom: { label: "Өөрийн зураг", Icon: ImageIcon },
};

function formatPopularity(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n > 0 ? String(Math.round(n)) : "—";
}

export function DetailPanel({ item }: { item: MediaItem | null }) {
  const heroWrap = useRef<HTMLDivElement>(null);
  const typeInfo = item
    ? (TYPE_INFO[item.mediaType] ?? { label: item.mediaType, Icon: Globe })
    : null;
  // Backdrop байхгүй үед poster-оор fallback (character/book/wiki гол төлөв ийм)
  const heroUrl = item
    ? (getBackdropUrl(item.backdropPath, "original") ??
      getPosterUrl(item.posterPath, "w500"))
    : null;
  const glowUrl = item
    ? (getBackdropUrl(item.backdropPath, "w1280") ??
      getPosterUrl(item.posterPath, "w342"))
    : null;

  return (
    <aside className="glass relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl lg:max-h-[calc(100vh-2rem)]">
      <AnimatePresence mode="wait">
        {item && typeInfo ? (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex h-full min-h-0 flex-col"
          >
            {/* Ambient glow — зургийг blur хийж арын гэрэлтүүлэг болгоно */}
            {glowUrl && (
              <div
                aria-hidden
                className="ambient-glow pointer-events-none absolute inset-0 scale-125 bg-cover bg-center opacity-50 blur-3xl saturate-150"
                style={{ backgroundImage: `url(${glowUrl})` }}
              />
            )}

            {/* Hero: Ken Burns (img) + mouse parallax (wrapper), гарчиг зураг дээр давхарлана */}
            <div
              className="relative z-10 aspect-[16/10] w-full shrink-0 overflow-hidden"
              onMouseMove={(e) => {
                const el = heroWrap.current;
                if (!el) return;
                const r = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - r.left) / r.width - 0.5) * 14;
                const y = ((e.clientY - r.top) / r.height - 0.5) * 10;
                el.style.transform = `translate(${x}px, ${y}px) scale(1.06)`;
              }}
              onMouseLeave={() => {
                if (heroWrap.current) heroWrap.current.style.transform = "";
              }}
            >
              {heroUrl && (
                <div
                  ref={heroWrap}
                  className="h-full w-full transition-transform duration-500 ease-out"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroUrl}
                    alt={item.title}
                    className={
                      item.backdropPath
                        ? "ken-burns h-full w-full object-cover"
                        : "h-full w-full object-contain py-2"
                    }
                  />
                </div>
              )}
              {/* Кино маягийн доод gradient + гарчиг */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-[oklch(0.15_0.014_270)] via-[oklch(0.15_0.014_270/0.55)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 pb-3">
                <h2 className="text-2xl font-extrabold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  {item.title}
                </h2>
                {item.subtitle && (
                  <p className="mt-0.5 text-sm text-foreground/70 drop-shadow">
                    {item.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-4 pt-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {item.year && (
                  <span className="font-medium text-foreground/80">
                    {item.year}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <typeInfo.Icon className="h-3.5 w-3.5" />
                  {typeInfo.label}
                </span>
                {/* Rating зөвхөн байгаа үед; эх сурвалж бүр өөр аргачлалтай тул
                    хажууд нь source badge — оноонууд хоорондоо харьцуулагдахгүй */}
                {item.rating > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Star className="h-3.5 w-3.5 fill-primary" />
                      {item.rating.toFixed(1)}
                    </span>
                    <span className="rounded border border-white/10 bg-white/5 px-1 py-px text-[9px] uppercase tracking-wide text-muted-foreground/70">
                      {sourceOfItemId(item.id)}
                    </span>
                  </span>
                )}
              </div>

              {/* Genre section бүхэлдээ зөвхөн genre байгаа үед (wiki/дүр/ихэнх номд байхгүй) */}
              {item.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.genres.map((g, i) => (
                    <span
                      key={g}
                      className="pop-in inline-block"
                      style={{ animationDelay: `${100 + i * 45}ms` }}
                    >
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/10 backdrop-blur"
                      >
                        {g}
                      </Badge>
                    </span>
                  ))}
                </div>
              )}

              {item.overview ? (
                <ScrollArea className="min-h-0 flex-1 pr-2">
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {item.overview}
                  </p>
                </ScrollArea>
              ) : (
                <div className="flex-1" />
              )}

              {/* Stats хөл — panel хоосон зайгүй дүүрнэ */}
              <div className="grid shrink-0 grid-cols-3 divide-x divide-white/8 rounded-xl border border-white/8 bg-black/20 py-2.5 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Оноо
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold">
                    {item.rating > 0 ? (
                      <>
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        {item.rating.toFixed(1)}
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Алдартай
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold">
                    <Flame className="h-3 w-3 text-primary" />
                    {formatPopularity(item.popularity)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Эх сурвалж
                  </p>
                  <p className="mt-0.5 text-sm font-bold">
                    {sourceOfItemId(item.id)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground/50"
          >
            <Clapperboard className="h-12 w-12" />
            <p className="text-sm leading-relaxed">
              Poster дээр дарах юм уу чирэхэд
              <br />
              дэлгэрэнгүй мэдээлэл энд гарна
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
