// Tier list-ийн өгөгдөл дээрх ЦЭВЭР (pure) үйлдлүүд.
// TierBoard-аас тусгаарласан шалтгаан: эдгээр нь React-гүйгээр тестлэгдэх ёстой
// логик (ялангуяа мөр устгахад watchLater алдагддаг байсан regression).
// Бүх функц шинэ обьект буцаана — оролтоо хэзээ ч мутаци хийхгүй.

import type { TierListData, TierRowData } from "./types";

export const TRAY_ID = "tray";
export const WATCH_LATER_ID = "watchLater";

/** Search-ээс шинээр нэмэгдэж буй item-ийн source утга */
export const SEARCH_SOURCE = "search";

/** Item аль container-т байгааг олно (мөрийн id | tray | watchLater | null) */
export function findContainer(d: TierListData, itemId: string): string | null {
  if (d.tray.includes(itemId)) return TRAY_ID;
  if (d.watchLater.includes(itemId)) return WATCH_LATER_ID;
  return d.rows.find((r) => r.itemIds.includes(itemId))?.id ?? null;
}

/** Container-ийн item id-ууд */
export function getIds(d: TierListData, container: string): string[] {
  if (container === TRAY_ID) return d.tray;
  if (container === WATCH_LATER_ID) return d.watchLater;
  return d.rows.find((r) => r.id === container)?.itemIds ?? [];
}

/** Container-ийн item id-уудыг солино (бусад талбарууд хэвээр) */
export function setIds(
  d: TierListData,
  container: string,
  ids: string[],
): TierListData {
  if (container === TRAY_ID) return { ...d, tray: ids };
  if (container === WATCH_LATER_ID) return { ...d, watchLater: ids };
  return {
    ...d,
    rows: d.rows.map((r) => (r.id === container ? { ...r, itemIds: ids } : r)),
  };
}

/** Board дээр (мөр/tray/watchLater аль нэгэнд) байгаа бүх item id */
export function collectItemIds(d: TierListData): Set<string> {
  const s = new Set<string>();
  for (const r of d.rows) for (const id of r.itemIds) s.add(id);
  for (const id of d.tray) s.add(id);
  for (const id of d.watchLater) s.add(id);
  return s;
}

/**
 * Мөр устгах: доторх item-ууд «Эрэмбэлээгүй» рүү буцна.
 * АНХААР: `...d` spread заавал хэрэгтэй — үгүй бол `watchLater` (болон
 * ирээдүйд нэмэгдэх аливаа талбар) чимээгүй алга болно. Энэ нь бодит
 * bug байсан тул tierData.test.ts-д тусгайлан хамгаалагдсан.
 */
export function removeRow(d: TierListData, rowId: string): TierListData {
  const row = d.rows.find((r) => r.id === rowId);
  return {
    ...d,
    rows: d.rows.filter((r) => r.id !== rowId),
    tray: [...d.tray, ...(row?.itemIds ?? [])],
  };
}

/** Мөр нэмэх */
export function addRow(d: TierListData, row: TierRowData): TierListData {
  return { ...d, rows: [...d.rows, row] };
}

/** Мөрийн нэр/өнгө засах */
export function editRow(
  d: TierListData,
  rowId: string,
  label: string,
  color: string,
): TierListData {
  return {
    ...d,
    rows: d.rows.map((r) => (r.id === rowId ? { ...r, label, color } : r)),
  };
}

/**
 * Click-to-assign: item-ийг target container-ийн төгсгөлд оруулна.
 * source === "search" бол шинээр нэмнэ (board дээр байвал өөрчлөлтгүй),
 * бусад тохиолдолд эх container-аасаа хасаж зөөнө.
 */
export function assignItem(
  d: TierListData,
  itemId: string,
  source: string,
  target: string,
): TierListData {
  if (source === target) return d;

  if (source === SEARCH_SOURCE) {
    if (collectItemIds(d).has(itemId)) return d; // давхардуулахгүй
    return setIds(d, target, [...getIds(d, target), itemId]);
  }

  const fromIds = getIds(d, source).filter((id) => id !== itemId);
  const toIds = [...getIds(d, target), itemId];
  return setIds(setIds(d, source, fromIds), target, toIds);
}

/**
 * Drag-over үед container хооронд шилжүүлэх: over хийж буй item-ийн
 * байрлалд оруулна (over нь container өөрөө бол төгсгөлд).
 */
export function moveToContainer(
  d: TierListData,
  itemId: string,
  from: string,
  to: string,
  overItemId?: string,
): TierListData {
  if (from === to) return d;
  const fromIds = getIds(d, from).filter((id) => id !== itemId);
  const toIds = [...getIds(d, to)];
  const overIndex = overItemId ? toIds.indexOf(overItemId) : -1;
  toIds.splice(overIndex >= 0 ? overIndex : toIds.length, 0, itemId);
  return setIds(setIds(d, from, fromIds), to, toIds);
}

/** Search-ээс drop хийхэд тодорхой байрлалд нэмэх (drag&drop зам) */
export function insertFromSearch(
  d: TierListData,
  itemId: string,
  target: string,
  overItemId?: string,
): TierListData {
  const toIds = [...getIds(d, target)];
  const overIndex = overItemId ? toIds.indexOf(overItemId) : -1;
  toIds.splice(overIndex >= 0 ? overIndex : toIds.length, 0, itemId);
  return setIds(d, target, toIds);
}
