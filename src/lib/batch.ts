// Bulk DB бичилтэд хэрэглэгдэх цэвэр туслахууд (db import-гүй тул тестлэгдэнэ).

/** Массивыг тогтмол хэмжээтэй хэсгүүдэд хуваана (сүүлийнх нь богино байж болно) */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new RangeError("chunk size 1-ээс багагүй байх ёстой");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * id-гаар давхардлыг арилгана (сүүлийн утга нь ялна).
 * ЗААВАЛ хэрэгтэй: нэг INSERT statement дотор ижил id хоёр удаа орвол Postgres
 * "ON CONFLICT DO UPDATE command cannot affect row a second time" алдаа шиднэ.
 * Хайлтын үр дүн олон эх сурвалжаас нийлдэг тул давхардал бодитоор гардаг.
 */
export function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((i) => [i.id, i])).values()];
}

/**
 * Хэд хэдэн жагсаалтыг ээлжлэн (round-robin) хольж нэгтгэнэ — эх сурвалж
 * бүрийн шилдэг үр дүн эхэнд тэнцүү оршино. Урт нь харилцан адилгүй байж болно.
 */
export function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}
