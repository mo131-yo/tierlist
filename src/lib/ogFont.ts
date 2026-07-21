// OG зурган дотор Монгол Кирилл текст (гарчиг, tier label) зөв харагдахын
// тулд шаардлагатай глиф бүхий фонт татах туслах.
//
// next/og (Satori) нь өөрийн бүрдэлд Cyrillic дэмждэггүй тул фонт заавал
// өгөх ёстой. Google Fonts CSS2 API-д `text=` параметр дамжуулбал ЗӨВХӨН
// хэрэгтэй тэмдэгтүүдийг агуулсан жижиг subset фонт буцаадаг бөгөөд
// (curl/bun fetch-ээр баталгаажуулсан) header тусгайлан тохируулаагүй
// энгийн fetch дээр эдгээрийг **truetype (ttf)** — next/og-ийн дэмждэг
// формат — хэлбэрээр өгдөг (browser fetch бол ихэвчлэн woff2 авдаг).

const GOOGLE_FONTS_CSS_URL = "https://fonts.googleapis.com/css2";

/** Google Fonts CSS2 URL — зөвхөн `text`-д орсон тэмдэгтүүдийн subset хүснэ */
export function buildFontCssUrl(
  text: string,
  family = "Noto Sans",
  weight = 700,
): string {
  const uniqueChars = [...new Set(text)].join("");
  const params = new URLSearchParams({
    family: `${family}:wght@${weight}`,
    text: uniqueChars,
  });
  return `${GOOGLE_FONTS_CSS_URL}?${params.toString()}`;
}

/** `@font-face { ... src: url(X) format('truetype'); }` CSS-ээс URL салгана */
export function parseFontUrlFromCss(css: string): string | null {
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  return match ? match[1] : null;
}

/**
 * Тухайн текстэд хэрэгтэй глифүүдийг агуулсан жижиг TTF фонт татна.
 * Сүлжээ/Google Fonts алдвал `null` буцаана — дуудагч талд заавал
 * fallback (энгийн карт) байх ёстой, throw хийхгүй.
 */
export async function fetchOgFont(
  text: string,
  weight = 700,
): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = buildFontCssUrl(text, "Noto Sans", weight);
    const cssRes = await fetch(cssUrl);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const fontUrl = parseFontUrlFromCss(css);
    if (!fontUrl) return null;

    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}
