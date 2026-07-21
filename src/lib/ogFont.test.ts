import { describe, expect, test } from "bun:test";
import { buildFontCssUrl, parseFontUrlFromCss } from "./ogFont";

describe("buildFontCssUrl", () => {
  test("текстээ давхардалгүй, кодлогдсон query-д оруулна", () => {
    const url = buildFontCssUrl("aab", "Noto Sans", 700);
    expect(url).toContain("family=Noto+Sans%3Awght%40700");
    // давхардсан "a" нэг л удаа орно
    const textParam = new URL(url).searchParams.get("text");
    expect(textParam).toBe("ab");
  });

  test("Кирилл тэмдэгт зөв дамжина", () => {
    const url = buildFontCssUrl("Шинэ", "Noto Sans", 700);
    const textParam = new URL(url).searchParams.get("text");
    expect(textParam).toBe("Шинэ");
  });

  test("өөр жин/фонт дамжуулж болно", () => {
    const url = buildFontCssUrl("x", "Noto Sans", 400);
    expect(url).toContain("wght%40400");
  });

  test("хоосон текст ч алдаа гаргахгүй", () => {
    expect(() => buildFontCssUrl("", "Noto Sans", 700)).not.toThrow();
  });
});

describe("parseFontUrlFromCss", () => {
  test("бодит Google Fonts CSS хариунаас URL салгана", () => {
    const css = `@font-face {
  font-family: 'Noto Sans';
  font-style: normal;
  font-weight: 700;
  font-stretch: normal;
  src: url(https://fonts.gstatic.com/l/font?kit=abc123&skey=def&v=v42) format('truetype');
}`;
    expect(parseFontUrlFromCss(css)).toBe(
      "https://fonts.gstatic.com/l/font?kit=abc123&skey=def&v=v42",
    );
  });

  test("URL олдоогүй үед null буцаана", () => {
    expect(parseFontUrlFromCss("")).toBeNull();
    expect(parseFontUrlFromCss("body { color: red; }")).toBeNull();
  });

  test("хэд хэдэн @font-face дундаас эхнийхийг авна", () => {
    const css = `
      @font-face { src: url(https://fonts.gstatic.com/first.ttf) format('truetype'); }
      @font-face { src: url(https://fonts.gstatic.com/second.ttf) format('truetype'); }
    `;
    expect(parseFontUrlFromCss(css)).toBe(
      "https://fonts.gstatic.com/first.ttf",
    );
  });
});
