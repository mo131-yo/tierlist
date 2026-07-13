"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MoreVertical, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortablePoster, POSTER_H } from "./PosterCard";
import type { MediaItem, TierRowData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TierRow({
  row,
  items,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  row: TierRowData;
  items: Record<string, MediaItem>;
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
  onEdit: (row: TierRowData) => void;
  onDelete: (rowId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `container:${row.id}` });

  return (
    <div className="flex overflow-hidden rounded-xl border border-white/5 bg-card/60">
      {/* Label — шууд дарахад нэр + өнгө засах dialog нээгдэнэ */}
      <div
        className="group/label relative flex w-20 shrink-0 cursor-pointer items-center justify-center px-1"
        style={{ backgroundColor: row.color }}
        onClick={() => onEdit(row)}
        title="Дарж нэр, өнгө засах"
      >
        <span
          className="max-w-full break-words text-center text-xl font-extrabold tracking-wide"
          style={{ color: "rgba(0,0,0,0.78)" }}
        >
          {row.label}
        </span>
        <Pencil className="pointer-events-none absolute bottom-1 left-1 h-3 w-3 text-black/0 transition-colors group-hover/label:text-black/50" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-0.5 h-6 w-6 text-black/50 hover:bg-black/10 hover:text-black/80"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onEdit(row)}>
              <Pencil className="h-4 w-4" /> Засах
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(row.id)}
            >
              <Trash2 className="h-4 w-4" /> Мөр устгах
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Items */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-wrap items-center gap-1.5 p-1.5 transition-colors",
          isOver && "bg-primary/10",
        )}
        style={{ minHeight: POSTER_H + 12 }}
      >
        <SortableContext
          items={row.itemIds}
          strategy={horizontalListSortingStrategy}
        >
          {row.itemIds.map((id) => {
            const item = items[id];
            if (!item) return null;
            return (
              <SortablePoster
                key={id}
                item={item}
                selected={selectedId === id}
                onSelect={onSelect}
              />
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
}
