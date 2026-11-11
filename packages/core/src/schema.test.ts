import { describe, expect, test } from "bun:test";
import {
  createColumn,
  createDiagram,
  createRelation,
  createTable,
} from "./factories";
import { parseDiagram } from "./schema";

function sampleDiagram() {
  const users = createTable({
    name: "users",
    columns: [createColumn({ name: "id", type: "int", primaryKey: true })],
  });
  const posts = createTable({
    name: "posts",
    columns: [
      createColumn({ name: "id", type: "int", primaryKey: true }),
      createColumn({ name: "user_id", type: "int", nullable: false }),
    ],
  });
  const diagram = createDiagram({ name: "Blog" });
  return {
    ...diagram,
    tables: [users, posts],
    relations: [
      createRelation({
        from: { tableId: posts.id, columnIds: [posts.columns[1]!.id] },
        to: { tableId: users.id, columnIds: [users.columns[0]!.id] },
        onDelete: "cascade",
      }),
    ],
    layout: {
      ...diagram.layout,
      tables: { [users.id]: { x: 0, y: 0 }, [posts.id]: { x: 300, y: 0 } },
    },
  };
}

describe("parseDiagram", () => {
  test("accepts a valid diagram", () => {
    const diagram = sampleDiagram();
    const result = parseDiagram(diagram);
    expect(result).toEqual({ ok: true, diagram });
  });

  test("accepts a diagram after a JSON round trip", () => {
    const diagram = sampleDiagram();
    const result = parseDiagram(JSON.parse(JSON.stringify(diagram)));
    expect(result.ok).toBe(true);
  });

  test("rejects values that are not a diagram", () => {
    expect(parseDiagram(null).ok).toBe(false);
    expect(parseDiagram("diagram").ok).toBe(false);
    expect(parseDiagram({}).ok).toBe(false);
  });

  test("rejects an unknown version", () => {
    const result = parseDiagram({ ...sampleDiagram(), version: 2 });
    expect(result.ok).toBe(false);
  });

  test("rejects a column with a wrong field type", () => {
    const diagram = sampleDiagram();
    const broken = structuredClone(diagram) as any;
    broken.tables[0].columns[0].nullable = "no";
    const result = parseDiagram(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nullable");
  });

  test("rejects a relation without columns", () => {
    const broken = structuredClone(sampleDiagram()) as any;
    broken.relations[0].from.columnIds = [];
    expect(parseDiagram(broken).ok).toBe(false);
  });

  test("rejects a zero zoom", () => {
    const broken = structuredClone(sampleDiagram()) as any;
    broken.layout.viewport.zoom = 0;
    expect(parseDiagram(broken).ok).toBe(false);
  });
});

describe("factories", () => {
  test("createDiagram starts empty", () => {
    const diagram = createDiagram();
    expect(diagram.version).toBe(1);
    expect(diagram.dialect).toBe("generic");
    expect(diagram.tables).toEqual([]);
    expect(diagram.relations).toEqual([]);
    expect(diagram.layout).toEqual({
      tables: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });

  test("every created item gets a different id", () => {
    const ids = new Set([
      createDiagram().id,
      createTable().id,
      createColumn().id,
      createColumn().id,
    ]);
    expect(ids.size).toBe(4);
  });

  test("columns are nullable unless they are a primary key", () => {
    expect(createColumn().nullable).toBe(true);
    expect(createColumn({ primaryKey: true }).nullable).toBe(false);
    expect(createColumn({ primaryKey: true, nullable: true }).nullable).toBe(
      true,
    );
  });

  test("optional fields are left out when not given", () => {
    expect("comment" in createTable()).toBe(false);
    expect("default" in createColumn()).toBe(false);
    expect(createColumn({ default: "0" }).default).toBe("0");
  });

  test("relations default to no action", () => {
    const relation = createRelation({
      from: { tableId: "a", columnIds: ["a1"] },
      to: { tableId: "b", columnIds: ["b1"] },
    });
    expect(relation.onDelete).toBe("no action");
    expect(relation.onUpdate).toBe("no action");
  });
});
