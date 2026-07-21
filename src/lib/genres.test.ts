import { describe, expect, test } from "bun:test";
import {
  BROWSE_CATS,
  BROWSE_GENRES,
  isGenreMode,
  matchesGenre,
  matchesGenres,
  type GenreDef,
} from "./genres";

const ACTION: GenreDef = { slug: "action", label: "Action", tmdbId: 28 };
const ROMANCE: GenreDef = { slug: "romance", label: "Romance", tmdbId: 10749 };
// AniList genre-ийн нэр TMDB label-аас ялгаатай байж болно
const SCIFI_AL: GenreDef = { slug: "sci-fi", label: "Sci-Fi", anilist: "Sci-Fi" };

describe("matchesGenre", () => {
  test("TMDB label-аар таарна", () => {
    expect(matchesGenre(["Action", "Drama"], ACTION)).toBe(true);
    expect(matchesGenre(["Drama"], ACTION)).toBe(false);
  });

  test("AniList нэрээр таарна", () => {
    expect(matchesGenre(["Sci-Fi", "Mecha"], SCIFI_AL)).toBe(true);
  });

  test("genre-гүй item (дүр/ном/wiki) таарахгүй", () => {
    expect(matchesGenre([], ACTION)).toBe(false);
  });
});

describe("matchesGenres — AND/OR горим", () => {
  test("AND: бүх genre байх ёстой", () => {
    expect(matchesGenres(["Action", "Romance"], [ACTION, ROMANCE], "and")).toBe(true);
    expect(matchesGenres(["Action"], [ACTION, ROMANCE], "and")).toBe(false);
  });

  test("OR: аль нэг нь хангалттай", () => {
    expect(matchesGenres(["Action"], [ACTION, ROMANCE], "or")).toBe(true);
    expect(matchesGenres(["Romance"], [ACTION, ROMANCE], "or")).toBe(true);
    expect(matchesGenres(["Drama"], [ACTION, ROMANCE], "or")).toBe(false);
  });

  test("OR нь AND-аас илүү өргөн (нарийсгахгүй)", () => {
    const item = ["Romance", "Drama"];
    expect(matchesGenres(item, [ACTION, ROMANCE], "and")).toBe(false);
    expect(matchesGenres(item, [ACTION, ROMANCE], "or")).toBe(true);
  });

  test("нэг genre дээр хоёр горим ижил үр дүн", () => {
    expect(matchesGenres(["Action"], [ACTION], "and")).toBe(
      matchesGenres(["Action"], [ACTION], "or"),
    );
  });

  test("genre сонгоогүй үед бүгд өнгөрнө", () => {
    expect(matchesGenres([], [], "and")).toBe(true);
    expect(matchesGenres([], [], "or")).toBe(true);
  });
});

describe("isGenreMode", () => {
  test("зөвхөн and/or зөвшөөрнө", () => {
    expect(isGenreMode("and")).toBe(true);
    expect(isGenreMode("or")).toBe(true);
    expect(isGenreMode("xor")).toBe(false);
    expect(isGenreMode(null)).toBe(false);
    expect(isGenreMode(undefined)).toBe(false);
  });
});

describe("BROWSE_GENRES бүрэн бүтэн байдал", () => {
  test("category бүрд genre байна", () => {
    for (const cat of BROWSE_CATS) {
      expect(BROWSE_GENRES[cat].length).toBeGreaterThan(0);
    }
  });

  test("movie/tv бүр tmdbId-тай, anime/manga бүр anilist нэртэй", () => {
    for (const g of [...BROWSE_GENRES.movie, ...BROWSE_GENRES.tv]) {
      expect(typeof g.tmdbId).toBe("number");
    }
    for (const g of [...BROWSE_GENRES.anime, ...BROWSE_GENRES.manga]) {
      expect(typeof g.anilist).toBe("string");
    }
  });

  test("category доторх slug давхардахгүй (cache key цэвэр байна)", () => {
    for (const cat of BROWSE_CATS) {
      const slugs = BROWSE_GENRES[cat].map((g) => g.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });
});
