import { describe, expect, test } from "bun:test";
import {
  SEARCH_SOURCE,
  TRAY_ID,
  WATCH_LATER_ID,
  addRow,
  assignItem,
  collectItemIds,
  editRow,
  findContainer,
  getIds,
  insertFromSearch,
  moveToContainer,
  removeRow,
  setIds,
} from "./tierData";
import { normalizeTierListData, type TierListData } from "./types";

function makeData(): TierListData {
  return {
    rows: [
      { id: "s", label: "S", color: "#ef4444", itemIds: ["movie-1", "movie-2"] },
      { id: "a", label: "A", color: "#f97316", itemIds: ["tv-3"] },
      { id: "b", label: "B", color: "#eab308", itemIds: [] },
    ],
    tray: ["book-4"],
    watchLater: ["al-a-5", "al-m-6"],
  };
}

describe("removeRow — watchLater regression", () => {
  // Bug: deleteRow нь `{rows, tray}` literal буцаадаг байсан тул мөр устгах
  // бүрд «Дараа үзэх» жагсаалт чимээгүй арчигддаг байсан.
  test("мөр устгахад watchLater хэвээр үлдэнэ", () => {
    const before = makeData();
    const after = removeRow(before, "s");
    expect(after.watchLater).toEqual(["al-a-5", "al-m-6"]);
  });

  test("устгасан мөрийн item-ууд tray руу очно", () => {
    const after = removeRow(makeData(), "s");
    expect(after.tray).toEqual(["book-4", "movie-1", "movie-2"]);
    expect(after.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("хэд хэдэн мөр дараалан устгасан ч watchLater амьд", () => {
    let d = makeData();
    d = removeRow(d, "s");
    d = removeRow(d, "a");
    d = removeRow(d, "b");
    expect(d.rows).toEqual([]);
    expect(d.watchLater).toEqual(["al-a-5", "al-m-6"]);
    expect(d.tray).toEqual(["book-4", "movie-1", "movie-2", "tv-3"]);
  });

  test("хадгалагдах JSON blob-д watchLater түлхүүр байсаар байна", () => {
    // Autosave нь JSON.stringify хийж DB-д бичдэг тул түлхүүр алга болбол
    // дараагийн ачаалалтад өгөгдөл бүрмөсөн алдагдана
    const json = JSON.parse(JSON.stringify(removeRow(makeData(), "a")));
    expect(Object.keys(json).sort()).toEqual(["rows", "tray", "watchLater"]);
    expect(json.watchLater).toHaveLength(2);
  });

  test("байхгүй мөрийн id өгөхөд өгөгдөл өөрчлөгдөхгүй", () => {
    const before = makeData();
    const after = removeRow(before, "yohoo");
    expect(after).toEqual(before);
  });

  test("оролтын обьектыг мутаци хийхгүй", () => {
    const before = makeData();
    removeRow(before, "s");
    expect(before.rows).toHaveLength(3);
    expect(before.tray).toEqual(["book-4"]);
  });
});

describe("normalizeTierListData", () => {
  test("хуучин {rows,tray} blob → watchLater: []", () => {
    const legacy = JSON.stringify({
      rows: [{ id: "s", label: "S", color: "#ef4444", itemIds: ["movie-1"] }],
      tray: ["tv-2"],
    });
    const d = normalizeTierListData(JSON.parse(legacy));
    expect(d.watchLater).toEqual([]);
    expect(d.tray).toEqual(["tv-2"]);
    expect(d.rows).toHaveLength(1);
  });

  test("хоосон/эвдэрсэн оролтод ч бүтэн бүтэц буцаана", () => {
    expect(normalizeTierListData(null)).toEqual({
      rows: [],
      tray: [],
      watchLater: [],
    });
    expect(normalizeTierListData({})).toEqual({
      rows: [],
      tray: [],
      watchLater: [],
    });
  });

  test("normalize хийсний дараа removeRow ажиллана", () => {
    const d = normalizeTierListData({
      rows: [{ id: "s", label: "S", color: "#ef4444", itemIds: ["movie-1"] }],
      tray: [],
    });
    const after = removeRow(d, "s");
    expect(after.tray).toEqual(["movie-1"]);
    expect(after.watchLater).toEqual([]);
  });
});

describe("getIds / setIds / findContainer", () => {
  test("гурван төрлийн container-ыг уншина", () => {
    const d = makeData();
    expect(getIds(d, "s")).toEqual(["movie-1", "movie-2"]);
    expect(getIds(d, TRAY_ID)).toEqual(["book-4"]);
    expect(getIds(d, WATCH_LATER_ID)).toEqual(["al-a-5", "al-m-6"]);
    expect(getIds(d, "байхгүй")).toEqual([]);
  });

  test("setIds зөвхөн зорилтот container-ыг өөрчилнө", () => {
    const d = makeData();
    const after = setIds(d, WATCH_LATER_ID, ["al-a-5"]);
    expect(after.watchLater).toEqual(["al-a-5"]);
    expect(after.tray).toEqual(d.tray);
    expect(after.rows).toEqual(d.rows);
  });

  test("setIds мөрөнд хэрэглэхэд tray/watchLater хөндөгдөхгүй", () => {
    const after = setIds(makeData(), "b", ["tv-9"]);
    expect(after.rows.find((r) => r.id === "b")!.itemIds).toEqual(["tv-9"]);
    expect(after.watchLater).toEqual(["al-a-5", "al-m-6"]);
  });

  test("findContainer item бүрийг зөв олно", () => {
    const d = makeData();
    expect(findContainer(d, "movie-2")).toBe("s");
    expect(findContainer(d, "tv-3")).toBe("a");
    expect(findContainer(d, "book-4")).toBe(TRAY_ID);
    expect(findContainer(d, "al-m-6")).toBe(WATCH_LATER_ID);
    expect(findContainer(d, "байхгүй-9")).toBeNull();
  });

  test("collectItemIds бүх container-ийг хамарна", () => {
    const ids = collectItemIds(makeData());
    expect(ids.size).toBe(6);
    expect(ids.has("al-m-6")).toBe(true);
    expect(ids.has("book-4")).toBe(true);
  });
});

describe("assignItem (click-to-assign)", () => {
  test("search-ээс мөрөнд нэмнэ", () => {
    const after = assignItem(makeData(), "movie-99", SEARCH_SOURCE, "b");
    expect(getIds(after, "b")).toEqual(["movie-99"]);
  });

  test("search-ээс watchLater-т нэмнэ", () => {
    const after = assignItem(makeData(), "movie-99", SEARCH_SOURCE, WATCH_LATER_ID);
    expect(after.watchLater).toEqual(["al-a-5", "al-m-6", "movie-99"]);
  });

  test("board дээр аль хэдийн байгаа item давхардахгүй", () => {
    const before = makeData();
    const after = assignItem(before, "movie-1", SEARCH_SOURCE, "b");
    expect(after).toEqual(before);
  });

  test("watchLater → мөр рүү зөөнө (эхнээсээ хасагдана)", () => {
    const after = assignItem(makeData(), "al-a-5", WATCH_LATER_ID, "s");
    expect(after.watchLater).toEqual(["al-m-6"]);
    expect(getIds(after, "s")).toEqual(["movie-1", "movie-2", "al-a-5"]);
  });

  test("мөр → мөр зөөнө", () => {
    const after = assignItem(makeData(), "movie-1", "s", "a");
    expect(getIds(after, "s")).toEqual(["movie-2"]);
    expect(getIds(after, "a")).toEqual(["tv-3", "movie-1"]);
  });

  test("tray → watchLater зөөнө", () => {
    const after = assignItem(makeData(), "book-4", TRAY_ID, WATCH_LATER_ID);
    expect(after.tray).toEqual([]);
    expect(after.watchLater).toEqual(["al-a-5", "al-m-6", "book-4"]);
  });

  test("ижил container руу оноох нь no-op", () => {
    const before = makeData();
    expect(assignItem(before, "movie-1", "s", "s")).toBe(before);
  });
});

describe("drag&drop туслахууд", () => {
  test("moveToContainer over item-ийн байрлалд оруулна", () => {
    const after = moveToContainer(makeData(), "book-4", TRAY_ID, "s", "movie-2");
    expect(getIds(after, "s")).toEqual(["movie-1", "book-4", "movie-2"]);
    expect(after.tray).toEqual([]);
  });

  test("moveToContainer over өгөөгүй үед төгсгөлд нэмнэ", () => {
    const after = moveToContainer(makeData(), "book-4", TRAY_ID, "a");
    expect(getIds(after, "a")).toEqual(["tv-3", "book-4"]);
  });

  test("moveToContainer ижил container дээр no-op", () => {
    const before = makeData();
    expect(moveToContainer(before, "movie-1", "s", "s")).toBe(before);
  });

  test("insertFromSearch байрлал заасан үед тэнд оруулна", () => {
    const after = insertFromSearch(makeData(), "tv-77", "s", "movie-1");
    expect(getIds(after, "s")).toEqual(["tv-77", "movie-1", "movie-2"]);
  });

  test("insertFromSearch watchLater-т ажиллана", () => {
    const after = insertFromSearch(makeData(), "tv-77", WATCH_LATER_ID);
    expect(after.watchLater).toEqual(["al-a-5", "al-m-6", "tv-77"]);
    expect(after.rows).toHaveLength(3);
  });
});

describe("addRow / editRow", () => {
  test("мөр нэмэхэд бусад талбар хэвээр", () => {
    const after = addRow(makeData(), {
      id: "c",
      label: "C",
      color: "#22c55e",
      itemIds: [],
    });
    expect(after.rows).toHaveLength(4);
    expect(after.watchLater).toHaveLength(2);
  });

  test("мөр засахад item-ууд нь хэвээр", () => {
    const after = editRow(makeData(), "s", "SSS", "#000000");
    const row = after.rows.find((r) => r.id === "s")!;
    expect(row.label).toBe("SSS");
    expect(row.color).toBe("#000000");
    expect(row.itemIds).toEqual(["movie-1", "movie-2"]);
    expect(after.watchLater).toHaveLength(2);
  });
});
