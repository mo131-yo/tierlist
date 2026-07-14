// Хайлтын үр дүнг query-тэй хэр тохирч байгаагаар нь оноожуулж эрэмбэлэх util.
// Гадаад API-нуудын fuzzy хайлт хамааралгүй зүйл оруулж ирдэг асуудлыг
// (ж: "spider man" → Haikyu, "car" → Central African Republic) сервер талд шийднэ.

/** Харьцуулалтад: жижиг үсэг + үсэг/тоо биш бүх тэмдэгтийг хаяна ("Spider-Man" ≡ "spider man") */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * query нь өгсөн талбаруудын аль нэгтэй хэр тохирохыг 0-100 оноогоор.
 * 100 яг таарсан · 80 эхэлж байгаа · 60 бүхэлдээ агуулагдсан ·
 * 40 бүх үг нь байгаа · 10×n зарим үг нь байгаа · 0 огт хамааралгүй
 */
export function scoreMatch(
  query: string,
  ...fields: (string | null | undefined)[]
): number {
  const nq = norm(query);
  if (!nq) return 0;
  const qTokens = tokenize(query);
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    const nf = norm(f);
    let s = 0;
    if (nf === nq) s = 100;
    else if (nf.startsWith(nq)) s = 80;
    else if (nf.includes(nq)) s = 60;
    else {
      const fTokens = tokenize(f);
      const hits = qTokens.filter((t) =>
        fTokens.some((w) => w === t || w.startsWith(t)),
      ).length;
      s = hits === qTokens.length && hits > 0 ? 40 : hits > 0 ? 10 * hits : 0;
    }
    if (s > best) best = s;
  }
  return best;
}

/** Бүх query үг талбарын үгсэд ЯГ (prefix биш) байгаа эсэх — франчайз/roster guard-д */
export function allTokensExact(query: string, field: string): boolean {
  const qt = tokenize(query);
  if (qt.length === 0) return false;
  const ft = new Set(tokenize(field));
  return qt.every((t) => ft.has(t));
}

/**
 * Оноогоор нь тогтвортой эрэмбэлнэ (тэнцвэл анхны дарааллаа хадгална).
 * dropZeros: оноотой үр дүн хангалттай (≥3) байвал 0 оноотойг хасна —
 * fuzzy API-ийн "сүүл"-ийн хамааралгүй үр дүнг цэвэрлэнэ.
 */
export function rankScored<T>(
  items: { item: T; score: number }[],
  dropZeros = false,
): T[] {
  const scored = items.filter((x) => x.score > 0).length;
  const keep = dropZeros && scored >= 3 ? items.filter((x) => x.score > 0) : items;
  return keep
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
}
