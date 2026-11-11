import { describe, expect, test } from "bun:test";
import { OperationError } from "../../shared";
import { createDiagram, getRelation, getTable, parseDiagram } from "./Diagram";
import { blogDiagram } from "./DiagramFixtures";

describe("parseDiagram", () => {
  test("accepts a valid diagram", () => {
    const diagram = blogDiagram();
    expect(parseDiagram(diagram)).toEqual({ ok: true, diagram });
  });

  test("accepts a diagram after a JSON round trip", () => {
    expect(parseDiagram(JSON.parse(JSON.stringify(blogDiagram()))).ok).toBe(
      true,
    );
  });

  test("rejects values that are not a diagram", () => {
    expect(parseDiagram(null).ok).toBe(false);
    expect(parseDiagram("diagram").ok).toBe(false);
    expect(parseDiagram({}).ok).toBe(false);
  });

  test("rejects an unknown version", () => {
    expect(parseDiagram({ ...blogDiagram(), version: 2 }).ok).toBe(false);
  });

  test("rejects a column with a wrong field type", () => {
    const broken = structuredClone(blogDiagram()) as any;
    broken.tables[0].columns[0].nullable = "no";
    const result = parseDiagram(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nullable");
  });

  test("rejects a relation without columns", () => {
    const broken = structuredClone(blogDiagram()) as any;
    broken.relations[0].from.columnIds = [];
    expect(parseDiagram(broken).ok).toBe(false);
  });

  test("rejects a zero zoom", () => {
    const broken = structuredClone(blogDiagram()) as any;
    broken.layout.viewport.zoom = 0;
    expect(parseDiagram(broken).ok).toBe(false);
  });
});

describe("createDiagram", () => {
  test("starts empty", () => {
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

  test("each diagram gets its own id", () => {
    expect(createDiagram().id).not.toBe(createDiagram().id);
  });
});

describe("getTable / getRelation", () => {
  test("find items by id", () => {
    const diagram = blogDiagram();
    expect(getTable(diagram, "users").name).toBe("users");
    expect(getRelation(diagram, "posts_user").to.tableId).toBe("users");
  });

  test("fail if the item does not exist", () => {
    expect(() => getTable(blogDiagram(), "nope")).toThrow(OperationError);
    expect(() => getRelation(blogDiagram(), "nope")).toThrow(OperationError);
  });
});
