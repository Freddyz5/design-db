import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { apply, applyAll, createDiagram } from "../../Diagrams";
import { createTable } from "../../Tables";
import { toDbml } from "./DbmlExport";
import { sampleDiagram } from "./FormatFixtures";

describe("toDbml", () => {
  test("writes project, enums, tables, refs and groups", () => {
    expect(toDbml(sampleDiagram())).toBe(
      `Project Blog {
  database_type: 'PostgreSQL'
}

Enum post_status {
  draft
  published
}

Table users {
  id integer [pk, increment]
  email varchar(255) [unique, not null]

  Note: 'People who write'
}

Table posts {
  id integer [pk, increment]
  user_id integer [not null]
  status post_status [not null, default: 'draft']
  order integer
  title text [note: 'Shown in lists']
}

Ref: posts.user_id > users.id [delete: cascade]

TableGroup accounts [color: #2c5f8e] {
  users
}
`,
    );
  });

  test("a generic diagram has no Project block", () => {
    const doc = { ...sampleDiagram(), dialect: "generic" as const };
    expect(toDbml(doc).startsWith("Enum post_status {")).toBe(true);
  });

  test("composite primary keys go in an indexes block", () => {
    const doc = apply(createDiagram(), {
      type: "table.add",
      table: createTable({
        name: "post_tags",
        columns: [
          createColumn({ name: "post_id", type: "int", primaryKey: true }),
          createColumn({ name: "tag", type: "text", primaryKey: true }),
        ],
      }),
    });
    expect(toDbml(doc)).toBe(
      `Table post_tags {
  post_id int [not null]
  tag text [not null]

  indexes {
    (post_id, tag) [pk]
  }
}
`,
    );
  });

  test("a unique foreign key is a one-to-one ref", () => {
    const doc = apply(sampleDiagram(), {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.user_id",
      patch: { unique: true },
    });
    expect(toDbml(doc)).toContain("Ref: posts.user_id - users.id");
  });

  test("named refs and both actions", () => {
    const doc = apply(sampleDiagram(), {
      type: "relation.update",
      relationId: "posts_user",
      patch: { name: "fk_user", onUpdate: "restrict" },
    });
    expect(toDbml(doc)).toContain(
      "Ref fk_user: posts.user_id > users.id [delete: cascade, update: restrict]",
    );
  });

  test("quotes names and types that need it and escapes strings", () => {
    const doc = applyAll(createDiagram(), [
      {
        type: "table.add",
        table: createTable({
          id: "t",
          name: "Order Lines",
          comment: "it's\nmulti-line",
          columns: [
            createColumn({ name: "unit price", type: "double precision" }),
            createColumn({
              name: "created",
              type: "timestamp",
              default: "now()",
            }),
            createColumn({ name: "active", type: "boolean", default: "TRUE" }),
            createColumn({ name: "qty", type: "int", default: "1" }),
            createColumn({ name: "label", type: "text", default: "'it''s'" }),
          ],
        }),
      },
      { type: "table.update", tableId: "t", patch: { color: "#ff8800" } },
    ]);
    const dbml = toDbml(doc);
    expect(dbml).toContain('Table "Order Lines" [headercolor: #ff8800] {');
    expect(dbml).toContain('  "unit price" "double precision"');
    expect(dbml).toContain("  created timestamp [default: `now()`]");
    expect(dbml).toContain("  active boolean [default: true]");
    expect(dbml).toContain("  qty int [default: 1]");
    expect(dbml).toContain("  label text [default: 'it\\'s']");
    expect(dbml).toContain("  Note: '''it's\nmulti-line'''");
  });

  test("colors that are not hex are left out", () => {
    const doc = apply(sampleDiagram(), {
      type: "group.update",
      groupId: "accounts",
      patch: { color: "teal" },
    });
    expect(toDbml(doc)).toContain("TableGroup accounts {");
  });

  test("an empty diagram gives an empty string", () => {
    expect(toDbml(createDiagram())).toBe("");
  });
});
