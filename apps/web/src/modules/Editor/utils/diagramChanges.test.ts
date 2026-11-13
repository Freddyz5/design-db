import { describe, expect, test } from "bun:test";
import {
  apply,
  applyAll,
  createColumn,
  createExampleDiagram,
  createTable,
  diffDiagram,
  type Diagram,
} from "@design-db/core";
import { changeCounts, changeMarks, describeChanges } from "./diagramChanges";

const ids = (diagram: Diagram, table: string, column?: string) => {
  const t = diagram.tables.find((x) => x.name === table)!;
  return { table: t.id, column: t.columns.find((c) => c.name === column)?.id };
};

/** The example with a base, then: a new table, posts.title renamed, comments.body removed, tags removed. */
function changed(): Diagram {
  let diagram = apply(createExampleDiagram(), {
    type: "base.set",
    at: "2026-11-13T07:00:00Z",
  });
  const title = ids(diagram, "posts", "title");
  const body = ids(diagram, "comments", "body");
  const tags = ids(diagram, "tags");
  diagram = applyAll(diagram, [
    {
      type: "table.add",
      table: createTable({
        id: "likes",
        name: "likes",
        columns: [createColumn({ name: "id", primaryKey: true })],
      }),
    },
    {
      type: "column.update",
      tableId: title.table,
      columnId: title.column!,
      patch: { name: "headline" },
    },
    { type: "column.remove", tableId: body.table, columnId: body.column! },
    { type: "table.remove", tableId: tags.table },
  ]);
  return diagram;
}

describe("changeMarks", () => {
  test("nothing to mark without a base", () => {
    expect(changeMarks(createExampleDiagram())).toEqual({
      tables: {},
      relations: {},
    });
  });

  test("marks new and changed tables and columns, and keeps removed columns to strike through", () => {
    const diagram = changed();
    const marks = changeMarks(diagram);
    expect(marks.tables["likes"]!.table).toBe("added");

    const posts = ids(diagram, "posts", "headline");
    expect(marks.tables[posts.table]!.columns).toEqual({
      [posts.column!]: "modified",
    });

    const comments = ids(diagram, "comments");
    expect(marks.tables[comments.table]!.removed.map((c) => c.name)).toEqual([
      "body",
    ]);
  });
});

describe("changeCounts", () => {
  test("counts added, modified and removed", () => {
    const counts = changeCounts(diffDiagram(changed())!);
    // likes; posts.headline; comments.body, tags and the relation posts_tags → tags.
    expect(counts).toEqual({ added: 1, modified: 1, removed: 3 });
  });
});

describe("describeChanges", () => {
  test("says each change in Spanish, with the table to show when it still exists", () => {
    const lines = describeChanges(changed());
    expect(lines).toEqual(
      expect.arrayContaining([
        { kind: "added", subject: "Tabla likes", detail: "", tableId: "likes" },
        expect.objectContaining({
          kind: "modified",
          subject: "Columna posts.headline",
          detail: "nombre",
        }),
        expect.objectContaining({
          kind: "removed",
          subject: "Columna comments.body",
        }),
        { kind: "removed", subject: "Tabla tags", detail: "" },
        expect.objectContaining({
          kind: "removed",
          subject: "Relación posts_tags → tags",
        }),
      ]),
    );
    const removedTable = lines.find((l) => l.subject === "Tabla tags")!;
    expect(removedTable.tableId).toBeUndefined();
  });
});
