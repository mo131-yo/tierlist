"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Bookmark, Inbox } from "lucide-react";
import type { MediaItem, TierRowData } from "@/lib/types";

export interface PickerState {
  item: MediaItem;
  /** "search" | "tray" | "watchLater" | tier мөрийн id */
  source: string;
  anchor: HTMLElement;
}

/**
 * Click-to-assign: poster дээр дарахад гарч ирэх жижиг popup — чирэлгүйгээр
 * аль tier-т оруулахаа шууд сонгоно. Анкор элементийнхээ хажууд fixed
 * байрлана; гадна дарахад/Esc/scroll хийхэд хаагдана.
 * Байрлалыг state-гүйгээр (DOM style-аар) тооцно — lint-ийн
 * set-state-in-effect дүрэмтэй нийцнэ.
 */
export function TierPickerPopover({
  picker,
  rows,
  trayCount,
  watchLaterCount,
  onAssign,
  onClose,
}: {
  picker: PickerState | null;
  rows: TierRowData[];
  trayCount: number;
  watchLaterCount: number;
  onAssign: (target: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Байрлал: анхдагчаар баруун талд, багтахгүй бол зүүн/доош шахна.
  // Deps байхгүй — рендер бүрийн дараа (panel хэмжээ өөрчлөгдсөн ч) шинэчилнэ.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !picker) return;
    const rect = picker.anchor.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    let left = rect.right + 8;
    if (left + pw > window.innerWidth - 8) left = rect.left - pw - 8;
    if (left < 8) left = Math.min(Math.max(8, rect.left), window.innerWidth - pw - 8);
    let top = rect.top;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    if (top < 8) top = 8;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.visibility = "visible";
  });

  // Гадна дарах / Esc / scroll → хаана
  useEffect(() => {
    if (!picker) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (picker.anchor.contains(t)) return; // анкор дээрх дахин дарахыг toggle-д үлдээнэ
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return; // panel доторх scroll OK
      onClose(); // хуудас гүйхэд анкораасаа салах тул хаана
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [picker, onClose]);

  // picker зөвхөн хэрэглэгчийн үйлдлээр (hydration-ы дараа) нээгддэг тул
  // SSR/эхний рендер хоёул null — mismatch гарахгүй
  if (!picker || typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      className="glass fixed z-[60] flex w-[185px] flex-col gap-0.5 rounded-xl border border-white/10 p-1.5 shadow-2xl shadow-black/50"
      style={{ left: -9999, top: 0, visibility: "hidden" }}
    >
      <p
        className="truncate px-1.5 pb-1 pt-0.5 text-[11px] font-semibold text-muted-foreground"
        title={picker.item.title}
      >
        {picker.item.title}
      </p>

      {rows
        .filter((r) => r.id !== picker.source)
        .map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onAssign(r.id)}
            className="flex h-8 items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold transition-colors hover:bg-white/10"
          >
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              {r.itemIds.length}
            </span>
          </button>
        ))}

      <div className="mx-1 my-0.5 h-px bg-white/10" />

      {picker.source !== "watchLater" && (
        <button
          type="button"
          onClick={() => onAssign("watchLater")}
          className="flex h-8 items-center gap-2 rounded-lg px-2 text-left text-xs font-medium text-amber-300/90 transition-colors hover:bg-amber-400/10"
        >
          <Bookmark className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Дараа үзэх</span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {watchLaterCount}
          </span>
        </button>
      )}

      {picker.source !== "tray" && (
        <button
          type="button"
          onClick={() => onAssign("tray")}
          className="flex h-8 items-center gap-2 rounded-lg px-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <Inbox className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Эрэмбэлээгүй</span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {trayCount}
          </span>
        </button>
      )}
    </motion.div>,
    document.body,
  );
}
