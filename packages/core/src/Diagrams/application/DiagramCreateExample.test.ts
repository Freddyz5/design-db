import { describe, expect, test } from "bun:test";
import { getCardinality } from "../../Relations";
import { findEnum, parseDiagram } from "../domain/Diagram";
import { validate } from "../domain/DiagramValidation";
import { createExampleDiagram } from "./DiagramCreateExample";

describe("createExampleDiagram", () => {
  test("has the expected tables", () => {
    const doc = createExampleDiagram();
    expect(doc.tables.map((t) => t.name)).toEqual([
      "users",
      "posts",
      "comments",
      "tags",
      "posts_tags",
    ]);
    expect(doc.relations).toHaveLength(5);
  });

  test("is valid and has no issues", () => {
    const doc = createExampleDiagram();
    expect(parseDiagram(JSON.parse(JSON.stringify(doc))).ok).toBe(true);
    expect(validate(doc)).toEqual([]);
  });

  test("every table has a position", () => {
    const doc = createExampleDiagram();
    for (const table of doc.tables) {
      expect(doc.layout.tables[table.id]).toBeDefined();
    }
  });

  test("comments.author_id is an optional 1:N relation", () => {
    const doc = createExampleDiagram();
    const comments = doc.tables.find((t) => t.name === "comments")!;
    const authorId = comments.columns.find((c) => c.name === "author_id")!;
    const relation = doc.relations.find((r) =>
      r.from.columnIds.includes(authorId.id),
    )!;
    expect(getCardinality(doc, relation)).toEqual({
      kind: "1:N",
      optional: true,
    });
  });

  test("returns new ids each time", () => {
    expect(createExampleDiagram().id).not.toBe(createExampleDiagram().id);
  });
});

describe("createExampleDiagram groups and enums", () => {
  test("has two groups and every table is in one", () => {
    const doc = createExampleDiagram();
    expect(doc.dialect).toBe("postgres");
    expect(doc.groups.map((g) => g.name)).toEqual(["Accounts", "Content"]);
    const groupOf = (name: string) =>
      doc.groups.find(
        (g) => g.id === doc.tables.find((t) => t.name === name)!.groupId,
      )!.name;
    expect(groupOf("users")).toBe("Accounts");
    expect(["posts", "comments", "tags", "posts_tags"].map(groupOf)).toEqual([
      "Content",
      "Content",
      "Content",
      "Content",
    ]);
  });

  test("posts.status uses the post_status enum", () => {
    const doc = createExampleDiagram();
    const status = doc.tables
      .find((t) => t.name === "posts")!
      .columns.find((c) => c.name === "status")!;
    expect(findEnum(doc, status.type)?.values).toEqual(["draft", "published"]);
  });
});
