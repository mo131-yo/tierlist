"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { SearchPoster, POSTER_H, POSTER_W } from "./PosterCard";
import { chunk } from "@/lib/batch";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const GRID_GAP = 8; // gap-x-2 = 0.5rem
const MIN_COL_W = 76; // өмнөх repeat(auto-fill, minmax(76px,1fr))-тэй тэнцүү
// Estimate — measureElement нь бодит render-ийн дараа автоматаар засна
const ESTIMATED_ROW_H = POSTER_H + 4 + 24 + 12;
// Item тоо цөөн үед virtualize хийх ач холбогдолгүй — шууд render
const VIRTUALIZE_THRESHOLD = 60;

/**
 * Босоо (доошоо урсдаг) poster grid — хайлтын үр дүн болон browse горим
 * хоёулаа үүгээр гарна. Доод sentinel харагдмагц onLoadMore дуудагдана
 * (infinite scroll) + гараар «Цааш үзэх» fallback товч.
 *
 * Олон зуун item дээр цонхны (window) виртуализаци ашиглан зөвхөн харагдаж
 * буй мөрүүдийг DOM-д барина. Чирэлт явж байх үед (dnd-kit) эх карт нь
 * scroll-оор DOM-оос гарч болзошгүй тул `dragging=true` үед л бүхэлд нь
 * (виртуализацигүй) render хийнэ.
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
  dragging = false,
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
  dragging?: boolean;
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

  // ---- Багана тоог контейнерийн өргөнөөс тооцно (auto-fill grid-ийн дуурайлт) ----
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const cols = Math.max(
        1,
        Math.floor((width + GRID_GAP) / (MIN_COL_W + GRID_GAP)),
      );
      setColumns(cols);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => chunk(items, columns), [items, columns]);

  // window virtualizer-ийн scroll offset нь баримт бичгийн эхнээс тооцогддог
  // тул grid-ийн эхлэлийн offsetTop-ыг мэдэх шаардлагатай (TanStack-ийн
  // зөвлөдөг загвар: mount дээр нэг л удаа хэмжинэ)
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    setScrollMargin(containerRef.current?.offsetTop ?? 0);
  }, []);

  const shouldVirtualize = !dragging && items.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_H,
    overscan: 4,
    scrollMargin,
    enabled: shouldVirtualize,
  });

  function renderItem(item: MediaItem, animate?: boolean, delay?: string) {
    const inWatchLater = watchLaterIds.has(item.id);
    return (
      <div
        key={item.id}
        className={cn("flex flex-col items-center gap-1", animate && "pop-in")}
        style={delay ? { animationDelay: delay } : undefined}
      >
        <div className="relative" style={{ width: POSTER_W }}>
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
              title={inWatchLater ? "«Дараа үзэх»-д нэмэгдсэн" : "Дараа үзэх"}
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
          className="line-clamp-2 w-full text-center text-[9.5px] leading-tight text-foreground/70"
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
  }

  return (
    <div>
      <div ref={containerRef}>
        {shouldVirtualize ? (
          <div
            style={{ position: "relative", height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 grid w-full gap-x-2 pb-3"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                }}
              >
                {/* Recycle хийгдэж буй мөрүүд тул mount-toon pop-in давтагдахгүй */}
                {rows[virtualRow.index]?.map((item) => renderItem(item))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-x-2 gap-y-3">
            {items.map((item, i) =>
              renderItem(item, true, `${Math.min(i % 30, 16) * 25}ms`),
            )}
          </div>
        )}
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
