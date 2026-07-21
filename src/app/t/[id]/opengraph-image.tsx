import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { getTierList, getMediaByIds } from "@/db/queries";
import { normalizeTierListData } from "@/lib/types";
import { getPosterUrl } from "@/lib/imageStore";
import { fetchOgFont } from "@/lib/ogFont";

// DB (postgres-js, TCP socket) ашигладаг тул Edge биш заавал Node runtime
export const runtime = "nodejs";
export const alt = "CineTier tier list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// 5 минут — crawler бүрд дахин зурахгүй, гэхдээ list шинэчлэгдвэл удаан хуучрахгүй
export const revalidate = 300;

const MAX_ROWS = 4;
const MAX_POSTERS_PER_ROW = 8;
const BG = "#111118";

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Хайлт/сервер алдаатай ч ажилладаг хамгийн энгийн үлдэц карт (JSX нь try/catch-ийн гадна) */
function fallbackElement(title: string): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: BG,
        color: "white",
      }}
    >
      <div style={{ display: "flex", fontSize: 56, fontWeight: 800 }}>{title}</div>
      <div
        style={{
          display: "flex",
          marginTop: 16,
          fontSize: 24,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        CineTier
      </div>
    </div>
  );
}

/**
 * DB-ээс уншиж JSX бэлтгэнэ. ЗОРИЛГОТОЙГООР try/catch-гүй — JSX-ийг
 * try/catch дотор шууд бичихийг React lint (error-boundaries) хориглодог
 * тул (Satori/ImageResponse-ийн алдаа бодитоор synchronous throw хийдэг ч)
 * дуудагч тал (`Image()`) энэ функцийг бүхэлд нь нэг try/catch-д ороож
 * хамгаална.
 */
async function buildElement(id: string): Promise<{
  element: ReactElement;
  fontData: ArrayBuffer | null;
} | null> {
  const list = await getTierList(id);
  if (!list) return null;

  const title = truncate(list.title || "Шинэ Tier List", 42);
  const data = normalizeTierListData(JSON.parse(list.data));
  const rows = data.rows.slice(0, MAX_ROWS).map((r) => ({
    ...r,
    label: truncate(r.label, 12),
  }));

  const posterIds = rows.flatMap((r) => r.itemIds.slice(0, MAX_POSTERS_PER_ROW));
  const items = await getMediaByIds(posterIds);
  const byId = new Map(items.map((i) => [i.id, i]));
  const totalCount = data.rows.reduce((n, r) => n + r.itemIds.length, 0);

  const rowsWithPosters = rows.map((r) => ({
    ...r,
    posters: r.itemIds
      .slice(0, MAX_POSTERS_PER_ROW)
      .map((itemId) => byId.get(itemId))
      .filter((item) => item?.posterPath)
      .map((item) => ({
        id: item!.id,
        title: item!.title,
        url: getPosterUrl(item!.posterPath, "w185")!,
      })),
  }));

  // Зурган дотор гарч ирэх бүх тэмдэгтийн Cyrillic-тэй subset фонт
  const fontText = [
    title,
    ...rows.map((r) => r.label),
    "CineTier",
    "бүтээл",
    String(totalCount),
  ].join("");
  const fontData = await fetchOgFont(fontText);

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
        padding: "36px 48px",
        fontFamily: fontData ? "Noto Sans" : undefined,
      }}
    >
      <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: "white", marginBottom: 24 }}>
        {title}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {rowsWithPosters.map((r) => (
          <div
            key={r.id}
            style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 14 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: 12,
                background: r.color,
                color: "rgba(0,0,0,0.78)",
                fontSize: 22,
                fontWeight: 800,
                marginRight: 16,
                flexShrink: 0,
              }}
            >
              {r.label}
            </div>
            <div style={{ display: "flex", flexDirection: "row" }}>
              {r.posters.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- Satori/next-og зурган route, next/image биш
                <img
                  key={p.id}
                  src={p.url}
                  alt={p.title}
                  width={48}
                  height={70}
                  style={{ borderRadius: 6, objectFit: "cover", marginLeft: i === 0 ? 0 : 6 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.4)" }}>CineTier</div>
        <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.4)" }}>
          {totalCount} бүтээл
        </div>
      </div>
    </div>
  );

  return { element, fontData };
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const built = await buildElement(id);
    if (!built) return new ImageResponse(fallbackElement("CineTier"), size);
    return new ImageResponse(built.element, {
      ...size,
      fonts: built.fontData
        ? [{ name: "Noto Sans", data: built.fontData, weight: 700, style: "normal" }]
        : undefined,
    });
  } catch (err) {
    // Гадаад CDN/фонт/DB унасан ч OG route хэзээ ч 500 өгөхгүй
    console.error(`[opengraph-image] ${id} failed:`, err);
    return new ImageResponse(fallbackElement("CineTier"), size);
  }
}
