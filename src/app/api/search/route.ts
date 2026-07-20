import { NextRequest, NextResponse, after } from "next/server";
import { cachedSearch, refreshSearch } from "@/db/queries";
import { isCategory, RateLimitError, type Category } from "@/lib/sources";

// Vercel edge дээр амжилттай хариуг кэшлэнэ — давтан query серверт ч хүрэхгүй.
// Алдаа/429-д ХЭЗЭЭ Ч тавихгүй (CDN алдааг кэшлэх вий).
const CACHE_HEADER = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ items: [] });

  const catParam = req.nextUrl.searchParams.get("cat");
  const cat: Category = isCategory(catParam) ? catParam : "all";

  try {
    const t0 = performance.now();
    const { items, cache } = await cachedSearch(cat, q);
    console.log(
      `[search] ${cat} "${q}" cache ${cache} — ${items.length} items in ${(performance.now() - t0).toFixed(1)}ms`,
    );
    if (cache === "STALE") {
      // Хуучирсан кэшийг шууд буцаачихаад, хариу явсны ДАРАА чимээгүй шинэчилнэ
      after(() => refreshSearch(cat, q));
    }
    return NextResponse.json(
      { items, cache },
      { headers: { "Cache-Control": CACHE_HEADER } },
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    console.error(`[search] ${cat} failed:`, err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
