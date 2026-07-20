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

function MiniPill({
  containerId,
  label,
  color,
  Icon,
  itemIds,
  items,
  onJump,
}: {
  containerId: string;
  label: string;
  color?: string;
  Icon?: LucideIcon;
  itemIds: string[];
  items: Record<string, MediaItem>;
  onJump: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `mini:${containerId}` });
  const thumbs = itemIds.slice(-3).map((id) => items[id]).filter(Boolean);

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onJump}
      title={`${label} — ${itemIds.length} · дарвал board руу очно`}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.04] px-2 py-1 transition-all hover:bg-white/10",
        isOver && "scale-105 border-primary/60 bg-primary/15",
      )}
    >
      {color ? (
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : Icon ? (
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      ) : null}
      <span className="max-w-16 truncate text-[11px] font-bold">{label}</span>
      <span className="text-[10px] text-muted-foreground">{itemIds.length}</span>
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
              itemIds={watchLater}
              items={items}
              onJump={onJump}
            />
            <MiniPill
              containerId="tray"
              label="Эрэмбэлээгүй"
              Icon={Inbox}
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
