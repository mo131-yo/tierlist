"use client";

import { useSortable } from "@dnd-kit/sortable";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { getPosterUrl } from "@/lib/imageStore";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const POSTER_W = 72;
export const POSTER_H = 108;

function PosterImage({
  item,
  selected,
  className,
}: {
  item: MediaItem;
  selected?: boolean;
  className?: string;
}) {
  const url = getPosterUrl(item.posterPath, "w342");
  return (
    <div
      className={cn(
        "poster-card relative shrink-0 overflow-hidden rounded-md bg-muted select-none",
        selected && "ring-2 ring-primary",
        className,
      )}
      style={{ width: POSTER_W, height: POSTER_H }}
      title={item.title}
    >
      {url ? (
        // TMDB CDN шууд — next/image optimizer-ийн нэмэлт сааталгүй, export-д proxy-гоор орлуулагдана
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={item.title}
          width={POSTER_W}
          height={POSTER_H}
          loading="lazy"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
          {item.title}
        </div>
      )}
    </div>
  );
}

/** Tier мөр/tray доторх эрэмбэлэгдэх poster */
export function SortablePoster({
  item,
  selected,
  onSelect,
  onPick,
}: {
  item: MediaItem;
  selected: boolean;
  onSelect: (item: MediaItem) => void;
  /** Дарахад tier сонгох popup нээнэ (чирэлт 6px threshold-оор ялгагдана) */
  onPick?: (item: MediaItem, anchor: HTMLElement) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { item } });

  return (
    <div
      ref={setNodeRef}
      data-item-id={item.id}
      // dnd-kit-ийн aria-describedby id сервер/клиент дээр зөрдөг тул
      // (танигдсан, хор хөнөөлгүй) hydration warning-ийг дарна
      suppressHydrationWarning
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        onSelect(item);
        onPick?.(item, e.currentTarget);
      }}
      // touch-none биш: утсан дээр хуудсыг босоогоор гүйлгэх боломж үлдэнэ,
      // харин зурган дээр удаан дарахад (TouchSensor delay) чирэлт эхэлнэ.
      // select-none/webkit-touch-callout — iOS-ийн long-press зурган цэс хаана.
      className="cursor-grab touch-pan-y select-none active:cursor-grabbing [-webkit-touch-callout:none]"
    >
      <PosterImage item={item} selected={selected} />
    </div>
  );
}

/** Хайлтын үр дүнгээс чирэх poster (board руу copy хийгдэнэ) */
export function SearchPoster({
  item,
  onBoard,
  selected,
  onSelect,
  onPick,
}: {
  item: MediaItem;
  onBoard: boolean;
  selected: boolean;
  onSelect: (item: MediaItem) => void;
  onPick?: (item: MediaItem, anchor: HTMLElement) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search:${item.id}`,
    data: { item },
    disabled: onBoard,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        onSelect(item);
        if (!onBoard) onPick?.(item, e.currentTarget);
      }}
      className={cn(
        "touch-pan-y select-none [-webkit-touch-callout:none]",
        onBoard ? "cursor-not-allowed opacity-35" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <PosterImage item={item} selected={selected} />
    </div>
  );
}

/** DragOverlay-д харагдах хувилбар */
export function PosterOverlay({ item }: { item: MediaItem }) {
  return (
    <div className="rotate-2 scale-110 shadow-2xl shadow-black/70">
      <PosterImage item={item} />
    </div>
  );
}
