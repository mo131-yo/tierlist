import { NextRequest, NextResponse } from "next/server";
import { cachedSearch } from "@/db/queries";
import { isCategory, RateLimitError, type Category } from "@/lib/sources";

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
    return NextResponse.json({ items, cache });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    console.error(`[search] ${cat} failed:`, err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
