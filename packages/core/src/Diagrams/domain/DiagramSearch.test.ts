import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { createTable } from "../../Tables";
import { createDiagram, type Diagram } from "./Diagram";
import { searchTables } from "./DiagramSearch";

function shop(): Diagram {
  const table = (name: string, ...columns: string[]) =>
    createTable({
      id: name,
      name,
      columns: columns.map((c) =>
        createColumn({ id: `${name}.${c}`, name: c }),
      ),
    });
  return {
    ...createDiagram(),
    tables: [
      table("order_items", "order_id", "price"),
      table("orders", "id", "user_id"),
      table("users", "id", "email"),
      table("categorías", "nombre"),
      table("reorders", "id"),
    ],
  };
}

const names = (results: ReturnType<typeof searchTables>) =>
  results.map((r) => r.table.name);

describe("searchTables", () => {
  test("prefix first (shorter first), then contains, then columns", () => {
    const results = searchTables(shop(), "order");
    expect(names(results)).toEqual(["orders", "order_items", "reorders"]);
    expect(results.map((r) => r.match)).toEqual(["prefix", "prefix", "name"]);
  });

  test("matches columns and says which ones", () => {
    const results = searchTables(shop(), "user_id");
    expect(results).toEqual([
      expect.objectContaining({
        match: "column",
        columnIds: ["orders.user_id"],
      }),
    ]);
  });

  test("ignores case and accents", () => {
    expect(names(searchTables(shop(), "CATEGORIAS"))).toEqual(["categorías"]);
    expect(names(searchTables(shop(), "nómbre"))).toEqual(["categorías"]);
  });

  test("an empty query finds nothing and the limit is respected", () => {
    expect(searchTables(shop(), "  ")).toEqual([]);
    expect(searchTables(shop(), "id", 2)).toHaveLength(2);
  });
});
