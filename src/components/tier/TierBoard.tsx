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
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Check,
  CloudUpload,
  Share2,
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
import { ShareMenu } from "@/components/ShareMenu";
import { uploadImageFiles } from "@/lib/uploadImages";
import { TierRow } from "./TierRow";
import { SearchTray } from "./SearchTray";
import { WatchLaterTray } from "./WatchLaterTray";
import { TierMiniMap } from "./TierMiniMap";
import { TierPickerPopover, type PickerState } from "./TierPickerPopover";
import { DetailPanel } from "./DetailPanel";
import { SortablePoster, PosterOverlay, POSTER_H } from "./PosterCard";
import {
  TIER_COLORS,
  normalizeTierListData,
  type MediaItem,
  type TierListData,
  type TierListMeta,
  type TierRowData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TRAY_ID = "tray";
const WATCH_LATER_ID = "watchLater";

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
  onPick,
  uploading,
  uploadFiles,
}: {
  itemIds: string[];
  items: Record<string, MediaItem>;
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
  onPick?: (item: MediaItem, anchor: HTMLElement) => void;
  uploading: number;
  uploadFiles: (files: FileList | File[]) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `container:${TRAY_ID}` });
  const [fileOver, setFileOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed transition-colors",
        fileOver
          ? "border-primary/60 bg-primary/10"
          : "border-white/10 bg-card/30",
      )}
      onDragOver={(e) => {
        // OS-оос файл чирч ирэх үед (dnd-kit pointer ашигладаг тул мөргөлдөхгүй)
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={() => setFileOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          setFileOver(false);
          uploadFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Эрэмбэлээгүй
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="h-3 w-3" /> Зураг нэмэх
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
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
                onPick={onPick}
              />
            ) : null,
          )}
        </SortableContext>
        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`up-${i}`}
            className="flex shrink-0 animate-pulse items-center justify-center rounded-md bg-white/5"
            style={{ width: 72, height: POSTER_H }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ))}
        {itemIds.length === 0 && uploading === 0 && (
          <p className="px-2 text-xs text-muted-foreground/50">
            Өөрийн зургаа энд чирж тавих эсвэл «Зураг нэмэх» дарж оруулна —
            хайлтын poster-уудыг ч энд түр хадгалж болно
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
  const [data, setData] = useState<TierListData>(() =>
    normalizeTierListData(JSON.parse(list.data)),
  );
  const [title, setTitle] = useState(list.title);
  const [items, setItems] = useState<Record<string, MediaItem>>(() =>
    Object.fromEntries(initialItems.map((i) => [i.id, i])),
  );
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [editingRow, setEditingRow] = useState<TierRowData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<{
    url: string;
    w: number;
    h: number;
  } | null>(null);
  const [uploading, setUploading] = useState(0);
  const [pageFileOver, setPageFileOver] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const fileDragDepth = useRef(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  // Хаана ч зураг тавьж болно: глобал drop + tray-ийн локал drop хоёул үүнийг дуудна
  const handleUploadFiles = useCallback((files: FileList | File[]) => {
    uploadImageFiles(
      files,
      (item) => {
        setItems((m) => ({ ...m, [item.id]: item }));
        setData((d) => ({ ...d, tray: [...d.tray, item.id] }));
        setSelected(item);
      },
      (delta) => setUploading((n) => Math.max(0, n + delta)),
    );
  }, []);

  /** Item тавигдмагц жижиг "pop" — амьд мэдрэмж */
  function popDropped(itemId: string) {
    requestAnimationFrame(() => {
      gsap.fromTo(
        `[data-item-id="${itemId}"]`,
        { scale: 1.15 },
        { scale: 1, duration: 0.35, ease: "back.out(2.5)", clearProps: "scale" },
      );
    });
  }

  const boardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Tier мөрүүд дэлгэцээс бүрэн гарсан үед mini-map гарч ирнэ
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setShowMiniMap(!entry.isIntersecting),
      { rootMargin: "-60px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Мөрүүд анх нээхэд stagger орж ирнэ (нэг удаа); clearProps — dnd-kit-ийн
  // transform-уудтай зөрчилдөхгүйн тулд дуусмагц inline style-ээ цэвэрлэнэ
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".tier-row", {
          y: 24,
          opacity: 0,
          stagger: 0.06,
          duration: 0.5,
          ease: "power3.out",
          clearProps: "all",
        });
      });
    },
    { scope: pageRef },
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const boardItemIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of data.rows) for (const id of r.itemIds) s.add(id);
    for (const id of data.tray) s.add(id);
    for (const id of data.watchLater) s.add(id);
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
      if (data.watchLater.includes(itemId)) return WATCH_LATER_ID;
      return data.rows.find((r) => r.itemIds.includes(itemId))?.id ?? null;
    },
    [data],
  );

  /** over.id → container id ("container:x"/"mini:x" droppable эсвэл доторх item id) */
  const resolveContainer = useCallback(
    (overId: string): string | null => {
      if (overId.startsWith("container:")) return overId.slice("container:".length);
      if (overId.startsWith("mini:")) return overId.slice("mini:".length);
      if (overId.startsWith("search:")) return null;
      return findContainer(overId);
    },
    [findContainer],
  );

  function getIds(d: TierListData, container: string): string[] {
    if (container === TRAY_ID) return d.tray;
    if (container === WATCH_LATER_ID) return d.watchLater;
    return d.rows.find((r) => r.id === container)?.itemIds ?? [];
  }

  function setIds(d: TierListData, container: string, ids: string[]): TierListData {
    if (container === TRAY_ID) return { ...d, tray: ids };
    if (container === WATCH_LATER_ID) return { ...d, watchLater: ids };
    return {
      ...d,
      rows: d.rows.map((r) => (r.id === container ? { ...r, itemIds: ids } : r)),
    };
  }

  function handleDragStart(e: DragStartEvent) {
    setPicker(null); // чирэлт эхэлбэл нээлттэй picker хаагдана
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
      popDropped(itemId);
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
    popDropped(activeId);
  }

  // ---------- Click-to-assign ----------
  /** Poster дээр дарахад picker нээх handler (source: search/tray/watchLater/rowId) */
  const openPicker = useCallback(
    (source: string) => (item: MediaItem, anchor: HTMLElement) => {
      // Нэг poster дээр дахин дарвал toggle хийж хаана
      setPicker((p) =>
        p && p.item.id === item.id && p.source === source
          ? null
          : { item, source, anchor },
      );
    },
    [],
  );

  /** Picker-ээс tier сонгоход: search-ээс бол нэмнэ, бусад нь зөөнө */
  function assignItem(item: MediaItem, source: string, target: string) {
    setPicker(null);
    if (source === target) return;

    if (source === "search") {
      if (boardItemIds.has(item.id)) {
        toast.info("Энэ нь аль хэдийн board дээр байна");
        return;
      }
      setItems((m) => ({ ...m, [item.id]: item }));
      setData((d) => setIds(d, target, [...getIds(d, target), item.id]));
    } else {
      setData((d) => {
        const fromIds = getIds(d, source).filter((id) => id !== item.id);
        const toIds = [...getIds(d, target), item.id];
        return setIds(setIds(d, source, fromIds), target, toIds);
      });
    }
    popDropped(item.id);
  }

  /** Browse/хайлтын 🔖 товч: «Дараа үзэх»-д шууд нэмнэ */
  function addToWatchLater(item: MediaItem) {
    if (boardItemIds.has(item.id)) {
      toast.info("Энэ нь аль хэдийн board дээр байна");
      return;
    }
    setItems((m) => ({ ...m, [item.id]: item }));
    setData((d) => ({ ...d, watchLater: [...d.watchLater, item.id] }));
    toast.success("«Дараа үзэх»-д нэмэгдлээ");
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
    // Шинэ мөр доороос эргэн орж ирнэ
    requestAnimationFrame(() => {
      gsap.from(".tier-row:last-child", {
        y: 22,
        opacity: 0,
        duration: 0.45,
        ease: "power3.out",
        clearProps: "all",
      });
    });
  }

  function deleteRow(rowId: string) {
    setData((d) => {
      const row = d.rows.find((r) => r.id === rowId);
      return {
        ...d, // watchLater зэрэг бусад талбарууд хэвээр үлдэнэ
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
      // Шууд татахгүй — эхлээд preview modal-д харуулна
      setExportPreview({
        url: dataUrl,
        w: EXPORT_WIDTH * ratio,
        h: Math.round(exportHeight * ratio),
      });
    } catch (err) {
      console.error(err);
      toast.error("Export амжилтгүй боллоо");
    } finally {
      wrapper.remove();
      setExporting(false);
    }
  }

  return (
    <div
      ref={pageRef}
      className="flex flex-1 flex-col gap-4 p-4 lg:p-6"
      onDragEnter={(e) => {
        if (e.dataTransfer?.types.includes("Files")) {
          fileDragDepth.current++;
          setPageFileOver(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        if (fileDragDepth.current > 0) {
          fileDragDepth.current--;
          if (fileDragDepth.current === 0) setPageFileOver(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer?.files?.length) {
          e.preventDefault();
          fileDragDepth.current = 0;
          setPageFileOver(false);
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Глобал файл-drop overlay: хаана ч зургаа тавьж болно */}
      {pageFileOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary/70 bg-card/60 px-16 py-12">
            <CloudUpload className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold">Зургаа энд тавь</p>
            <p className="text-sm text-muted-foreground">
              «Эрэмбэлээгүй» хэсэгт нэмэгдэнэ
            </p>
          </div>
        </div>
      )}
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
        <ShareMenu
          url={`/t/${list.id}`}
          title={title}
          trigger={
            <Button variant="ghost">
              <Share2 className="h-4 w-4" />
              Хуваалцах
            </Button>
          }
        />
        <Button onClick={exportPng} disabled={exporting} variant="secondary">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download
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
            {/* Доошоо гүйлгэхэд tier-үүдийн байдал дээр наалдаж харагдана */}
            <TierMiniMap
              visible={showMiniMap}
              rows={data.rows}
              tray={data.tray}
              watchLater={data.watchLater}
              items={items}
              onJump={() =>
                boardRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            />
            <div ref={boardRef} className="flex flex-col gap-2 rounded-2xl p-1">
              {data.rows.map((row) => (
                <TierRow
                  key={row.id}
                  row={row}
                  items={items}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelected}
                  onPick={openPicker(row.id)}
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
              onPick={openPicker(TRAY_ID)}
              uploading={uploading}
              uploadFiles={handleUploadFiles}
            />

            <WatchLaterTray
              itemIds={data.watchLater}
              items={items}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onPick={openPicker(WATCH_LATER_ID)}
            />

            <SearchTray
              boardItemIds={boardItemIds}
              watchLaterIds={new Set(data.watchLater)}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onPick={openPicker("search")}
              onWatchLater={addToWatchLater}
            />
          </div>

          {/* Баруун: detail panel — sticky тул доор хайж байхад ч сонголт харагдана */}
          <div className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[380px] lg:self-start xl:w-[440px]">
            <DetailPanel item={selected} />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? <PosterOverlay item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Click-to-assign: poster дээр дарахад tier сонгох popup */}
      <TierPickerPopover
        picker={picker}
        rows={data.rows}
        trayCount={data.tray.length}
        watchLaterCount={data.watchLater.length}
        onAssign={(target) => {
          if (picker) assignItem(picker.item, picker.source, target);
        }}
        onClose={() => setPicker(null)}
      />

      {/* Download preview dialog — татахын өмнө ямар харагдахыг үзүүлнэ */}
      <Dialog
        open={!!exportPreview}
        onOpenChange={(o) => !o && setExportPreview(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Татахын өмнөх урьдчилсан харагдац</DialogTitle>
          </DialogHeader>
          {exportPreview && (
            <>
              <div className="max-h-[65vh] overflow-auto rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={exportPreview.url}
                  alt="Tier list preview"
                  className="w-full"
                />
              </div>
              <DialogFooter className="items-center gap-2">
                <span className="mr-auto text-xs text-muted-foreground">
                  {exportPreview.w}×{exportPreview.h}px PNG
                </span>
                <Button variant="ghost" onClick={() => setExportPreview(null)}>
                  Болих
                </Button>
                <Button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = exportPreview.url;
                    a.download = `${title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "tierlist"}.png`;
                    a.click();
                    toast.success("Татагдлаа");
                    setExportPreview(null);
                  }}
                >
                  <Download className="h-4 w-4" /> Татах
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
