"use client";

import { useEffect, useRef } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { SearchPoster } from "./PosterCard";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Босоо (доошоо урсдаг) poster grid — хайлтын үр дүн болон browse горим
 * хоёулаа үүгээр гарна. Доод sentinel харагдмагц onLoadMore дуудагдана
 * (infinite scroll) + гараар «Цааш үзэх» fallback товч.
 */
export function MediaGrid({
  items,
  boardItemIds,
  watchLaterIds,
  selectedId,
  showSubtitles,
  onSelect,
  onPick,
  onWatchLater,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  items: MediaItem[];
  boardItemIds: Set<string>;
  watchLaterIds: Set<string>;
  selectedId: string | null;
  showSubtitles: boolean;
  onSelect: (item: MediaItem) => void;
  onPick?: (item: MediaItem, anchor: HTMLElement) => void;
  onWatchLater?: (item: MediaItem) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Observer callback дотор үргэлж хамгийн сүүлийн утгуудыг харна
  const stateRef = useRef({ hasMore, loadingMore, onLoadMore });
  useEffect(() => {
    stateRef.current = { hasMore, loadingMore, onLoadMore };
  }, [hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const s = stateRef.current;
        if (entries[0].isIntersecting && s.hasMore && !s.loadingMore) {
          s.onLoadMore?.();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-x-2 gap-y-3">
        {items.map((item, i) => {
          const inWatchLater = watchLaterIds.has(item.id);
          return (
            <div
              key={item.id}
              className="pop-in flex flex-col items-center gap-1"
              style={{ animationDelay: `${Math.min(i % 30, 16) * 25}ms` }}
            >
              <div className="relative w-[72px]">
                <SearchPoster
                  item={item}
                  onBoard={boardItemIds.has(item.id)}
                  selected={selectedId === item.id}
                  onSelect={onSelect}
                  onPick={onPick}
                />
                {onWatchLater && (
                  <button
                    type="button"
                    title={
                      inWatchLater ? "«Дараа үзэх»-д нэмэгдсэн" : "Дараа үзэх"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!inWatchLater) onWatchLater(item);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute right-0.5 top-0.5 z-10 rounded-md p-1 backdrop-blur-sm transition-colors",
                      inWatchLater
                        ? "bg-amber-400/90 text-black"
                        : "bg-black/55 text-white/80 hover:bg-amber-400/90 hover:text-black",
                    )}
                  >
                    {inWatchLater ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
              {/* Нэр байнга харагдана — юу болохыг hover хийлгүй мэднэ */}
              <span
                className="line-clamp-2 w-full text-center text-[9.5px] leading-[1.25] text-foreground/70"
                title={item.title}
              >
                {item.title}
              </span>
              {showSubtitles && item.subtitle && (
                <span
                  className="w-full truncate text-center text-[8.5px] leading-tight text-muted-foreground/60"
                  title={item.subtitle}
                >
                  {item.subtitle}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Infinite scroll sentinel — байнга DOM-д байна (observer нэг л удаа холбогддог) */}
      <div ref={sentinelRef} className="h-px w-full" />
      {(hasMore || loadingMore) && (
        <div className="mt-2 flex justify-center">
          {loadingMore ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={() => onLoadMore?.()}
              className="rounded-full bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              Цааш үзэх
            </button>
          )}
        </div>
      )}
    </div>
  );
}
