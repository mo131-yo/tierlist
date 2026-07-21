"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Inbox, type LucideIcon } from "lucide-react";
import { getPosterUrl } from "@/lib/imageStore";
import type { MediaItem, TierRowData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Доошоо (browse/хайлтын урт grid рүү) гүйлгэсэн үед дэлгэцийн дээд талд
 * наалддаг tier-үүдийн mini-map: мөр бүрийн өнгө, тоо, сүүлийн зургууд.
 * Pill бүр droppable (`mini:{rowId}`) тул гүн scroll хийсэн ч чирч
 * буулгаж болно; дарвал board руу эргэж очно.
 */

/** Tier мөрөөс ялгарах accent — эрэмбэлэгдээгүй үлдсэн зүйлсийг анзааруулна */
type PillAccent = "row" | "tray" | "watchLater";

const ACCENT_STYLE: Record<
  Exclude<PillAccent, "row">,
  { filled: string; empty: string; icon: string }
> = {
  watchLater: {
    filled: "bg-amber-400 text-black ring-1 ring-amber-300/50",
    empty: "bg-white/5 text-muted-foreground/50",
    icon: "text-amber-400/80",
  },
  tray: {
    filled: "bg-white/85 text-black",
    empty: "bg-white/5 text-muted-foreground/50",
    icon: "text-muted-foreground",
  },
};

function MiniPill({
  containerId,
  label,
  color,
  Icon,
  accent = "row",
  itemIds,
  items,
  onJump,
}: {
  containerId: string;
  label: string;
  color?: string;
  Icon?: LucideIcon;
  accent?: PillAccent;
  itemIds: string[];
  items: Record<string, MediaItem>;
  onJump: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `mini:${containerId}` });
  const thumbs = itemIds.slice(-3).map((id) => items[id]).filter(Boolean);
  const count = itemIds.length;
  const accentStyle = accent === "row" ? null : ACCENT_STYLE[accent];

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onJump}
      title={
        accentStyle
          ? `${label} — ${count} зүйл үлдсэн · дарвал board руу очно`
          : `${label} — ${count} · дарвал board руу очно`
      }
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.04] px-2 py-1 transition-all hover:bg-white/10",
        isOver && "scale-105 border-primary/60 bg-primary/15",
        // Үлдсэн зүйлтэй tray/watchLater нь tier мөрүүдээс ялгарч харагдана
        accent === "watchLater" && count > 0 && "border-amber-400/30 bg-amber-400/10",
      )}
    >
      {color ? (
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : Icon ? (
        <Icon className={cn("h-3 w-3 shrink-0", accentStyle?.icon)} />
      ) : null}
      <span className="max-w-16 truncate text-[11px] font-bold">{label}</span>
      {accentStyle ? (
        // Badge: эрэмбэлэхээр хүлээж буй зүйл хэд үлдсэнийг тодотгоно
        <span
          className={cn(
            "min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 tabular-nums transition-colors",
            count > 0 ? accentStyle.filled : accentStyle.empty,
          )}
        >
          {count}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground">{count}</span>
      )}
      {thumbs.length > 0 && (
        <span className="flex gap-0.5">
          {thumbs.map((it) => {
            const url = getPosterUrl(it.posterPath, "w342");
            return url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={it.id}
                src={url}
                alt={it.title}
                width={16}
                height={24}
                loading="lazy"
                className="h-6 w-4 rounded-[3px] object-cover"
              />
            ) : null;
          })}
        </span>
      )}
    </button>
  );
}

export function TierMiniMap({
  visible,
  rows,
  tray,
  watchLater,
  items,
  onJump,
}: {
  visible: boolean;
  rows: TierRowData[];
  tray: string[];
  watchLater: string[];
  items: Record<string, MediaItem>;
  onJump: () => void;
}) {
  return (
    // h-0 sticky wrapper: гарч ирэхдээ доорх контентыг түлхэхгүй (layout shift-гүй)
    <div className="sticky top-2 z-40 h-0">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="glass fade-x flex gap-1.5 overflow-x-auto rounded-xl border border-white/10 p-1.5 shadow-lg shadow-black/40"
          >
            {rows.map((r) => (
              <MiniPill
                key={r.id}
                containerId={r.id}
                label={r.label}
                color={r.color}
                itemIds={r.itemIds}
                items={items}
                onJump={onJump}
              />
            ))}
            <MiniPill
              containerId="watchLater"
              label="Дараа үзэх"
              Icon={Bookmark}
              accent="watchLater"
              itemIds={watchLater}
              items={items}
              onJump={onJump}
            />
            <MiniPill
              containerId="tray"
              label="Эрэмбэлээгүй"
              Icon={Inbox}
              accent="tray"
              itemIds={tray}
              items={items}
              onJump={onJump}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
