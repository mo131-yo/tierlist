import { NextRequest, NextResponse } from "next/server";
import { supabaseHost } from "@/lib/supabase";

// PNG export-д зориулсан proxy: гадаад зургууд cross-origin тул canvas-д шууд
// зурвал taint хийгддэг. Энэ route серверээс татаж same-origin болгож өгнө.
// Зөвхөн мэдэгдэж буй эх сурвалжуудын image host-уудыг зөвшөөрнө (SSRF хамгаалалт).
const ALLOWED_HOSTS = new Set(
  [
    "image.tmdb.org", // TMDB
    "s4.anilist.co", // AniList cover/character зургууд
    "covers.openlibrary.org", // Open Library номын cover
    "upload.wikimedia.org", // Wikipedia thumbnail
    supabaseHost(), // хэрэглэгчийн upload хийсэн зургууд (custom-images bucket)
  ].filter((h): h is string => Boolean(h)),
);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  const upstream = await fetch(parsed.toString());
  if (!upstream.ok) {
    return new NextResponse("Upstream error", { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      // TMDB зургийн path өөрчлөгддөггүй тул давтан export агшин зуур болно
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
