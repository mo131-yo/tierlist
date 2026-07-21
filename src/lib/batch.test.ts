import { describe, expect, test } from "bun:test";
import { chunk, dedupeById } from "./batch";

describe("chunk", () => {
  test("тэгш хуваагдана", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  test("сүүлийн хэсэг богино байж болно", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("хэмжээнээс бага массив нэг хэсэг болно", () => {
    expect(chunk([1, 2], 100)).toEqual([[1, 2]]);
  });

  test("хоосон массив → хоосон үр дүн (statement огт явахгүй)", () => {
    expect(chunk([], 100)).toEqual([]);
  });

  test("буруу хэмжээ хаяна (хязгааргүй давталтаас сэргийлнэ)", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });

  test("оролтоо мутаци хийхгүй", () => {
    const src = [1, 2, 3];
    chunk(src, 2);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe("dedupeById", () => {
  test("давхардсан id-г нэг болгоно", () => {
    const items = [
      { id: "movie-1", title: "A" },
      { id: "movie-2", title: "B" },
      { id: "movie-1", title: "A2" },
    ];
    expect(dedupeById(items)).toHaveLength(2);
  });

  test("сүүлийн утга ялна (хамгийн шинэ metadata үлдэнэ)", () => {
    const items = [
      { id: "movie-1", title: "хуучин" },
      { id: "movie-1", title: "шинэ" },
    ];
    expect(dedupeById(items)[0].title).toBe("шинэ");
  });

  test("анхны дараалал хадгалагдана", () => {
    const items = [
      { id: "c", n: 1 },
      { id: "a", n: 2 },
      { id: "b", n: 3 },
      { id: "a", n: 4 },
    ];
    expect(dedupeById(items).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  test("«Бүгд» хайлтын олон эх сурвалжийн давхардлыг барина", () => {
    // TMDB movie + tv + AniList зэрэг эх сурвалжууд ижил id өгч болно
    const merged = [
      { id: "movie-1" },
      { id: "al-a-5" },
      { id: "movie-1" },
      { id: "al-a-5" },
      { id: "tv-9" },
    ];
    expect(dedupeById(merged).map((i) => i.id)).toEqual([
      "movie-1",
      "al-a-5",
      "tv-9",
    ]);
  });

  test("хоосон оролт", () => {
    expect(dedupeById([])).toEqual([]);
  });
});
