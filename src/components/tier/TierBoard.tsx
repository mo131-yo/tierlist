"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import Link from "next/link";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Link2,
  Loader2,
  Plus,
  Check,
  CloudUpload,
} from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyText } from "@/lib/clipboard";
import { TierRow } from "./TierRow";
import { SearchTray } from "./SearchTray";
import { DetailPanel } from "./DetailPanel";
import { SortablePoster, PosterOverlay, POSTER_H } from "./PosterCard";
import {
  TIER_COLORS,
  type MediaItem,
  type TierListData,
  type TierListMeta,
  type TierRowData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TRAY_ID = "tray";

// PNG export: утас/цонхны хэмжээ, scroll-оос үл хамааран энэ өргөнтэй
// desktop layout-аар export хийгдэнэ
const EXPORT_WIDTH = 1200;
// Canvas-ийн аюулгүй дээд хязгаар — үүнээс давбал pixelRatio буурна
const MAX_EXPORT_PIXELS = 16_000_000;

function UnrankedTray({
  itemIds,
  items,
  selectedId,
  onSelect,
}: {
  itemIds: string[];
  items: Record<string, MediaItem>;
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `container:${TRAY_ID}` });
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-card/30">
      <p className="px-3 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        Эрэмбэлээгүй
      </p>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-wrap items-center gap-1.5 p-2 transition-colors",
          isOver && "bg-primary/10",
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
              />
            ) : null,
          )}
        </SortableContext>
        {itemIds.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground/40">
            Түр хадгалах зай — poster-оо энд ч хаяж болно
          </p>
        )}
      </div>
    </div>
  );
}

export function TierBoard({
  list,
  initialItems,
}: {
  list: TierListMeta;
  initialItems: MediaItem[];
}) {
  const [data, setData] = useState<TierListData>(
    () => JSON.parse(list.data) as TierListData,
  );
  const [title, setTitle] = useState(list.title);
  const [items, setItems] = useState<Record<string, MediaItem>>(() =>
    Object.fromEntries(initialItems.map((i) => [i.id, i])),
  );
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [editingRow, setEditingRow] = useState<TierRowData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const boardRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const boardItemIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of data.rows) for (const id of r.itemIds) s.add(id);
    for (const id of data.tray) s.add(id);
    return s;
  }, [data]);

  // ---------- Autosave: debounce + version counter + AbortController ----------
  const saveVersion = useRef(0);
  const saveAbort = useRef<AbortController | null>(null);
  const skipFirstSave = useRef(true);

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      const version = ++saveVersion.current; // сүүлийн хадгалалт үргэлж ялна
      saveAbort.current?.abort();
      const ac = new AbortController();
      saveAbort.current = ac;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/tierlists/${list.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, data }),
          signal: ac.signal,
        });
        // Хуучирсан хариу UI-ийн төлөвийг дарж бичихгүй
        if (version === saveVersion.current) {
          setSaveState(res.ok ? "saved" : "error");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && version === saveVersion.current) {
          setSaveState("error");
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [data, title, list.id]);

  // ---------- DnD ----------
  const findContainer = useCallback(
    (itemId: string): string | null => {
      if (data.tray.includes(itemId)) return TRAY_ID;
      return data.rows.find((r) => r.itemIds.includes(itemId))?.id ?? null;
    },
    [data],
  );

  /** over.id → container id ("container:x" droppable эсвэл доторх item id) */
  const resolveContainer = useCallback(
    (overId: string): string | null => {
      if (overId.startsWith("container:")) return overId.slice("container:".length);
      if (overId.startsWith("search:")) return null;
      return findContainer(overId);
    },
    [findContainer],
  );

  function getIds(d: TierListData, container: string): string[] {
    return container === TRAY_ID
      ? d.tray
      : (d.rows.find((r) => r.id === container)?.itemIds ?? []);
  }

  function setIds(d: TierListData, container: string, ids: string[]): TierListData {
    if (container === TRAY_ID) return { ...d, tray: ids };
    return {
      ...d,
      rows: d.rows.map((r) => (r.id === container ? { ...r, itemIds: ids } : r)),
    };
  }

  function handleDragStart(e: DragStartEvent) {
    const item = (e.active.data.current as { item?: MediaItem })?.item;
    if (item) {
      setActiveItem(item);
      setSelected(item); // чирж эхлэхэд баруун panel-д мэдээлэл гарна
    }
  }

  function handleDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id);
    if (activeId.startsWith("search:")) return; // search-ээс copy нь зөвхөн dragEnd дээр
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;

    const from = findContainer(activeId);
    const to = resolveContainer(overId);
    if (!from || !to || from === to) return;

    setData((d) => {
      const fromIds = getIds(d, from).filter((id) => id !== activeId);
      const toIds = [...getIds(d, to)];
      const overIndex = toIds.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : toIds.length;
      toIds.splice(insertAt, 0, activeId);
      return setIds(setIds(d, from, fromIds), to, toIds);
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveItem(null);
    if (!overId) return;

    // Search-ээс шинэ item нэмэх (copy)
    if (activeId.startsWith("search:")) {
      const itemId = activeId.slice("search:".length);
      const item = (e.active.data.current as { item?: MediaItem })?.item;
      const to = resolveContainer(overId);
      if (!to || !item) return;
      if (boardItemIds.has(itemId)) {
        toast.info("Энэ нь аль хэдийн board дээр байна");
        return;
      }
      setItems((m) => ({ ...m, [itemId]: item }));
      setData((d) => {
        const toIds = [...getIds(d, to)];
        const overIndex = toIds.indexOf(overId);
        toIds.splice(overIndex >= 0 ? overIndex : toIds.length, 0, itemId);
        return setIds(d, to, toIds);
      });
      return;
    }

    // Нэг container доторх эрэмбэ солих
    const container = findContainer(activeId);
    if (!container) return;
    const ids = getIds(data, container);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      setData((d) => setIds(d, container, arrayMove(getIds(d, container), oldIndex, newIndex)));
    }
  }

  // ---------- Мөр удирдах ----------
  function addRow() {
    setData((d) => ({
      ...d,
      rows: [
        ...d.rows,
        {
          id: nanoid(6),
          label: "Шинэ",
          color: TIER_COLORS[d.rows.length % TIER_COLORS.length],
          itemIds: [],
        },
      ],
    }));
  }

  function deleteRow(rowId: string) {
    setData((d) => {
      const row = d.rows.find((r) => r.id === rowId);
      return {
        rows: d.rows.filter((r) => r.id !== rowId),
        tray: [...d.tray, ...(row?.itemIds ?? [])], // item-ууд нь эрэмбэлээгүй рүү буцна
      };
    });
  }

  function saveRowEdit(rowId: string, label: string, color: string) {
    setData((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === rowId ? { ...r, label, color } : r)),
    }));
    setEditingRow(null);
  }

  // ---------- PNG Export (CORS-гүй: proxy + далд clone, бүтэн grid) ----------
  async function exportPng() {
    const node = boardRef.current;
    if (!node) return;
    setExporting(true);
    const wrapper = document.createElement("div");
    try {
      // Далд clone дээр ажиллана — дэлгэцийн UI огт хөндөгдөхгүй.
      // АНХААР: boardRef доторх компонентуудад (TierRow, PosterCard) sm:/md:/lg:
      // responsive class нэмж болохгүй — тэдгээр нь viewport-media query тул
      // EXPORT_WIDTH-ийн fixed layout-ыг үл тоомсорлуулна (одоогоор байхгүй).
      const clone = node.cloneNode(true) as HTMLElement;
      wrapper.style.cssText = `position:fixed;left:-100000px;top:0;z-index:-1;width:${EXPORT_WIDTH}px;`;

      // Export-ийн бүрэн frame: гарчиг + board + брэнд тэмдэг
      // Export-д хэрэггүй UI элементүүдийг (3 цэгийн цэс, hover icon) хасна
      clone.querySelectorAll("[data-noexport]").forEach((el) => el.remove());

      const exportRoot = document.createElement("div");
      // Системийн фонт — html-to-image webfont embed найдваргүй тул
      // бүх текст (tier label, гарчиг) тод sans-serif-ээр баталгаатай гарна
      exportRoot.style.cssText = `width:${EXPORT_WIDTH}px;padding:24px;background:#111118;font-family:'Segoe UI',Arial,sans-serif;`;

      const header = document.createElement("div");
      header.textContent = title;
      header.style.cssText =
        "color:#fff;font-size:30px;font-weight:800;padding:4px 8px 16px;";

      const brand = document.createElement("div");
      brand.textContent = "CineTier";
      brand.style.cssText =
        "color:rgba(255,255,255,0.35);font-size:12px;text-align:right;padding:10px 8px 0;font-family:sans-serif;";

      clone.style.width = "100%";
      exportRoot.append(header, clone, brand);
      wrapper.appendChild(exportRoot);
      document.body.appendChild(wrapper);

      if (exportRoot.offsetWidth !== EXPORT_WIDTH) {
        console.warn(
          `[export] clone width ${exportRoot.offsetWidth} ≠ ${EXPORT_WIDTH} — responsive class нэвтэрсэн байж магадгүй`,
        );
      }

      // Cross-origin зургуудыг proxy-гоор base64 болгож урьдчилж уншина
      const imgs = Array.from(exportRoot.querySelectorAll("img"));
      await Promise.all(
        imgs.map(async (img) => {
          img.loading = "eager"; // далд clone дотор lazy skip хийхээс сэргийлнэ
          const src = img.src;
          if (!src) return;
          try {
            // Same-origin биш бүх зургийг (TMDB, AniList, OpenLibrary, Wikipedia)
            // proxy-гоор татаж CORS taint-аас сэргийлнэ
            const fetchUrl = src.startsWith(window.location.origin)
              ? src
              : `/api/image-proxy?url=${encodeURIComponent(src)}`;
            const blob = await fetch(fetchUrl).then((r) => {
              if (!r.ok) throw new Error(String(r.status));
              return r.blob();
            });
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result as string);
              fr.onerror = reject;
              fr.readAsDataURL(blob);
            });
            img.srcset = "";
            img.src = dataUrl;
          } catch {
            /* нэг зураг унавал export бүхэлдээ зогсохгүй */
          }
        }),
      );

      // Чанар: DPR≥2 дэлгэцэд 3, бусад нь 2; маш урт board дээр canvas
      // 16MP-ээс давахгүй байхаар 3→2→1 рүү автоматаар бууруулна
      let ratio = (window.devicePixelRatio ?? 1) >= 2 ? 3 : 2;
      const exportHeight = exportRoot.offsetHeight;
      while (
        ratio > 1 &&
        EXPORT_WIDTH * exportHeight * ratio * ratio > MAX_EXPORT_PIXELS
      ) {
        ratio--;
      }

      const dataUrl = await toPng(exportRoot, {
        backgroundColor: "#111118",
        pixelRatio: ratio,
        skipFonts: true, // системийн фонт ашигладаг тул webfont embed алгасна (хурдан + найдвартай)
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "tierlist"}.png`;
      a.click();
      toast.success("PNG татагдлаа");
    } catch (err) {
      console.error(err);
      toast.error("Export амжилтгүй боллоо");
    } finally {
      wrapper.remove();
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 w-auto min-w-[220px] max-w-md border-transparent bg-transparent text-xl font-bold focus-visible:border-white/15 focus-visible:bg-black/20"
        />
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" && (
            <>
              <CloudUpload className="h-3.5 w-3.5 animate-pulse" /> Хадгалж байна…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Хадгалагдсан
            </>
          )}
          {saveState === "error" && (
            <span className="text-red-400">Хадгалж чадсангүй</span>
          )}
        </span>
        <Button
          variant="ghost"
          onClick={async () => {
            const ok = await copyText(`${window.location.origin}/t/${list.id}`);
            if (ok) toast.success("Линк хуулагдлаа");
            else toast.error("Хуулж чадсангүй");
          }}
        >
          <Link2 className="h-4 w-4" />
          Хуваалцах
        </Button>
        <Button onClick={exportPng} disabled={exporting} variant="secondary">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          PNG
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItem(null)}
      >
        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          {/* Зүүн: board + tray + search */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div ref={boardRef} className="flex flex-col gap-2 rounded-2xl p-1">
              {data.rows.map((row) => (
                <TierRow
                  key={row.id}
                  row={row}
                  items={items}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelected}
                  onEdit={setEditingRow}
                  onDelete={deleteRow}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={addRow}
              className="self-start text-muted-foreground"
            >
              <Plus className="h-4 w-4" /> Мөр нэмэх
            </Button>

            <UnrankedTray
              itemIds={data.tray}
              items={items}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />

            <SearchTray
              boardItemIds={boardItemIds}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onResults={() => {}}
            />
          </div>

          {/* Баруун: detail panel */}
          <div className="w-full shrink-0 lg:w-[380px] xl:w-[440px]">
            <DetailPanel item={selected} />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? <PosterOverlay item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Мөр засах dialog */}
      <Dialog open={!!editingRow} onOpenChange={(o) => !o && setEditingRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Мөр засах</DialogTitle>
          </DialogHeader>
          {editingRow && (
            <RowEditForm
              row={editingRow}
              onSave={(label, color) => saveRowEdit(editingRow.id, label, color)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowEditForm({
  row,
  onSave,
}: {
  row: TierRowData;
  onSave: (label: string, color: string) => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [color, setColor] = useState(row.color);
  return (
    <div className="flex flex-col gap-4">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        maxLength={16}
      />
      <div className="flex flex-wrap gap-2">
        {TIER_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
              color === c ? "border-white" : "border-transparent",
            )}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(label.trim() || row.label, color)}>
          Хадгалах
        </Button>
      </DialogFooter>
    </div>
  );
}
