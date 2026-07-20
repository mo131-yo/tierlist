"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Bookmark } from "lucide-react";
import { SortablePoster, POSTER_H } from "./PosterCard";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * «Дараа үзэх» tray — browse/хайлтаас bookmark хийсэн item-ууд энд
 * хадгалагдаж, дараа нь чирч эсвэл дарж tier-т оноогдоно.
 * container:watchLater droppable тул drag handler-ууд өөрчлөлтгүй ажиллана.
 */
export function WatchLaterTray({
  itemIds,
  items,
  selectedId,
  onSelect,
  onPick,
}: {
  itemIds: string[];
  items: Record<string, MediaItem>;
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
  onPick?: (item: MediaItem, anchor: HTMLElement) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "container:watchLater" });

  return (
    <div className="rounded-xl border border-dashed border-amber-400/20 bg-card/30">
      <div className="flex items-center gap-1.5 px-3 pt-2">
        <Bookmark className="h-3.5 w-3.5 text-amber-400/70" />
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Дараа үзэх
        </p>
        {itemIds.length > 0 && (
          <span className="text-xs text-muted-foreground/50">
            {itemIds.length}
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-wrap items-center gap-1.5 p-2 transition-colors",
          isOver && "bg-amber-400/10",
        )}
        style={{ minHeight: POSTER_H + 10 }}
      >
        <SortableContext items={itemIds} strategy={horizontalListSortingStrategy}>
          {itemIds.map((id) =>
            items[id] ? (
              <SortablePoster
                key={id}
                item={items[id]}
                selected={selectedId === id}
                onSelect={onSelect}
                onPick={onPick}
              />
            ) : null,
          )}
        </SortableContext>
        {itemIds.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground/50">
            Доорх жагсаалтаас 🔖 товч дарахад энд хадгалагдана — дараа нь дарж
            tier-ээ сонгоорой
          </p>
        )}
      </div>
    </div>
  );
}
