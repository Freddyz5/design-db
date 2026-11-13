import { describe, expect, test } from "bun:test";
import {
  apply,
  createColumn,
  createExampleDiagram,
  createTable,
  type Diagram,
  type Position,
} from "@design-db/core";
import ELK from "elkjs/lib/elk.bundled.js";
import { autoLayout, layoutUnplaced } from "./autoLayout";
import { drawnSizes } from "./canvasElements";

const elk = new ELK();

type Box = { x: number; y: number; width: number; height: number };

function boxes(diagram: Diagram, positions: Record<string, Position>): Box[] {
  const sizes = drawnSizes(diagram);
  return Object.entries(positions).map(([id, at]) => ({
    ...at,
    ...sizes[id]!,
  }));
}

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

describe("autoLayout", () => {
  test("places every table, without overlaps, at whole pixels", async () => {
    const diagram = createExampleDiagram();
    const positions = await autoLayout(diagram, drawnSizes(diagram), elk);
    expect(Object.keys(positions).sort()).toEqual(
      diagram.tables.map((t) => t.id).sort(),
    );
    const placed = boxes(diagram, positions);
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) expect(overlap(a, b)).toBe(false);
      expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
    }
  });

  test("tables in a group keep the same room between them as the rest", async () => {
    const diagram = createExampleDiagram();
    const positions = await autoLayout(diagram, drawnSizes(diagram), elk);
    const placed = boxes(diagram, positions);
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) {
        const apart = Math.max(
          b.x - (a.x + a.width),
          a.x - (b.x + b.width),
          b.y - (a.y + a.height),
          a.y - (b.y + b.height),
        );
        expect(apart).toBeGreaterThanOrEqual(48);
      }
    }
  });

  test("parents go left of the tables that point at them", async () => {
    const diagram = createExampleDiagram();
    const positions = await autoLayout(diagram, drawnSizes(diagram), elk);
    for (const relation of diagram.relations) {
      const parent = positions[relation.to.tableId]!;
      const child = positions[relation.from.tableId]!;
      expect(parent.x).toBeLessThan(child.x);
    }
  });

  test("an empty diagram has nothing to place", async () => {
    const empty = { ...createExampleDiagram(), tables: [], relations: [] };
    expect(await autoLayout(empty, {}, elk)).toEqual({});
  });
});

describe("layoutUnplaced", () => {
  test("places only the tables without a position, to the right of the rest", async () => {
    let diagram = createExampleDiagram();
    for (const name of ["likes", "follows"]) {
      diagram = {
        ...diagram,
        tables: [
          ...diagram.tables,
          createTable({
            id: name,
            name,
            columns: [createColumn({ name: "id", primaryKey: true })],
          }),
        ],
      };
    }
    const sizes = drawnSizes(diagram);
    const positions = await layoutUnplaced(diagram, sizes, elk);
    expect(Object.keys(positions).sort()).toEqual(["follows", "likes"]);

    const right = Math.max(
      ...Object.entries(diagram.layout.tables).map(
        ([id, at]) => at.x + sizes[id]!.width,
      ),
    );
    for (const at of Object.values(positions)) {
      expect(at.x).toBeGreaterThan(right);
    }
  });

  test("nothing to do when every table has a position", async () => {
    const diagram = createExampleDiagram();
    expect(await layoutUnplaced(diagram, drawnSizes(diagram), elk)).toEqual({});
  });

  test("the result places the tables in one step with layout.place", async () => {
    const diagram = createExampleDiagram();
    const positions = await autoLayout(diagram, drawnSizes(diagram), elk);
    const next = apply(diagram, { type: "layout.place", positions });
    expect(next.layout.tables[diagram.tables[0]!.id]).toMatchObject(
      positions[diagram.tables[0]!.id]!,
    );
  });
});
