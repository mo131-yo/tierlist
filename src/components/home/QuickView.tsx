"use client";

// Marquee poster дээр дарахад гарах хөнгөн дэлгэрэнгүй dialog
import { Star, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TYPE_INFO } from "@/components/tier/DetailPanel";
import { getBackdropUrl, getPosterUrl } from "@/lib/imageStore";
import { sourceOfItemId, type MediaItem } from "@/lib/types";

export function QuickView({
  item,
  onClose,
}: {
  item: MediaItem | null;
  onClose: () => void;
}) {
  const info = item
    ? (TYPE_INFO[item.mediaType] ?? { label: item.mediaType, Icon: Globe })
    : null;
  const heroUrl = item
    ? (getBackdropUrl(item.backdropPath, "w1280") ??
      getPosterUrl(item.posterPath, "w500"))
    : null;

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {item && info && (
          <>
            <div className="relative h-56 w-full overflow-hidden">
              {heroUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroUrl}
                  alt={item.title}
                  className={
                    item.backdropPath
                      ? "h-full w-full object-cover"
                      : "h-full w-full object-contain py-2"
                  }
                />
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-[oklch(0.15_0.014_270)] to-transparent" />
              <DialogTitle className="absolute inset-x-0 bottom-0 p-4 pb-3 text-xl font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                {item.title}
              </DialogTitle>
            </div>
            <div className="flex flex-col gap-3 p-5 pt-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {item.year && (
                  <span className="font-medium text-foreground/80">
                    {item.year}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <info.Icon className="h-3.5 w-3.5" />
                  {info.label}
                </span>
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
              {item.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.genres.map((g) => (
                    <Badge
                      key={g}
                      variant="secondary"
                      className="border-white/10 bg-white/10"
                    >
                      {g}
                    </Badge>
                  ))}
                </div>
              )}
              {item.overview && (
                <p className="line-clamp-6 text-sm leading-relaxed text-foreground/80">
                  {item.overview}
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
