import { describe, expect, test } from "bun:test";
import {
  apply,
  createColumn,
  createDiagram,
  createGroup,
  createRelation,
  createTable,
  validate,
  type Diagram,
} from "@design-db/core";
import {
  addGroupWith,
  columnRelation,
  nextColumnName,
  referenceType,
  setColumnReference,
  tableIssues,
} from "./tableEdits";

/** users(id serial PK, email) and posts(id PK, author_id, editor_id), with no relations. */
function blog(): Diagram {
  const users = createTable({
    id: "users",
    name: "users",
    columns: [
      createColumn({
        id: "users.id",
        name: "id",
        type: "serial",
        primaryKey: true,
      }),
      createColumn({
        id: "users.email",
        name: "email",
        type: "varchar(255)",
        unique: true,
      }),
    ],
  });
  const posts = createTable({
    id: "posts",
    name: "posts",
    columns: [
      createColumn({
        id: "posts.id",
        name: "id",
        type: "serial",
        primaryKey: true,
      }),
      createColumn({ id: "posts.author_id", name: "author_id", type: "text" }),
      createColumn({
        id: "posts.editor_id",
        name: "editor_id",
        type: "integer",
      }),
    ],
  });
  let diagram = createDiagram();
  diagram = apply(diagram, { type: "table.add", table: users });
  diagram = apply(diagram, { type: "table.add", table: posts });
  return diagram;
}

const posts = (diagram: Diagram) => diagram.tables[1]!;

describe("nextColumnName", () => {
  test("numbers from the amount of columns and skips names in use", () => {
    expect(nextColumnName(posts(blog()), "columna")).toBe("columna_4");
    const taken = apply(blog(), {
      type: "column.add",
      tableId: "posts",
      column: createColumn({ name: "Ref_5" }),
    });
    expect(nextColumnName(posts(taken), "ref")).toBe("ref_6");
  });
});

describe("referenceType", () => {
  test("drops the auto-numbering of serial types", () => {
    expect(referenceType("serial")).toBe("integer");
    expect(referenceType("BIGSERIAL")).toBe("bigint");
    expect(referenceType("uuid")).toBe("uuid");
    expect(referenceType("varchar(255)")).toBe("varchar(255)");
  });
});

describe("setColumnReference", () => {
  test("points the column at the primary key of the table and takes its type", () => {
    const next = setColumnReference(blog(), "posts", "posts.author_id", {
      tableId: "users",
    });
    const relation = columnRelation(next, "posts", "posts.author_id")!;
    expect(relation.from).toEqual({
      tableId: "posts",
      columnIds: ["posts.author_id"],
    });
    expect(relation.to).toEqual({ tableId: "users", columnIds: ["users.id"] });
    expect(posts(next).columns[1]!.type).toBe("integer");
    expect(validate(next)).toEqual([]);
  });

  test("points at the column that was asked for", () => {
    const next = setColumnReference(blog(), "posts", "posts.author_id", {
      tableId: "users",
      columnId: "users.email",
    });
    expect(
      columnRelation(next, "posts", "posts.author_id")!.to.columnIds,
    ).toEqual(["users.email"]);
    expect(posts(next).columns[1]!.type).toBe("varchar(255)");
  });

  test("changing the target keeps ON DELETE and ON UPDATE, in one relation", () => {
    let diagram = setColumnReference(blog(), "posts", "posts.author_id", {
      tableId: "users",
    });
    diagram = apply(diagram, {
      type: "relation.update",
      relationId: columnRelation(diagram, "posts", "posts.author_id")!.id,
      patch: { onDelete: "cascade", onUpdate: "restrict" },
    });
    const next = setColumnReference(diagram, "posts", "posts.author_id", {
      tableId: "posts",
    });
    expect(next.relations).toHaveLength(1);
    expect(next.relations[0]).toMatchObject({
      to: { tableId: "posts", columnIds: ["posts.id"] },
      onDelete: "cascade",
      onUpdate: "restrict",
    });
  });

  test("without a target the column stops being a foreign key", () => {
    const linked = setColumnReference(blog(), "posts", "posts.author_id", {
      tableId: "users",
    });
    const next = setColumnReference(
      linked,
      "posts",
      "posts.author_id",
      undefined,
    );
    expect(next.relations).toEqual([]);
    expect(posts(next).columns[1]!.type).toBe("integer");
  });

  test("leaves a relation over several columns alone", () => {
    const composite = apply(blog(), {
      type: "relation.add",
      relation: createRelation({
        from: {
          tableId: "posts",
          columnIds: ["posts.author_id", "posts.editor_id"],
        },
        to: { tableId: "users", columnIds: ["users.id", "users.email"] },
      }),
    });
    expect(
      setColumnReference(composite, "posts", "posts.author_id", undefined),
    ).toBe(composite);
  });
});

describe("addGroupWith", () => {
  test("creates Grupo N with a free palette color and puts the tables in it", () => {
    const start = apply(blog(), {
      type: "group.add",
      group: createGroup({ name: "Grupo 2", color: "blue" }),
    });
    const { diagram, groupId } = addGroupWith(start, ["posts"]);
    const group = diagram.groups.find((g) => g.id === groupId)!;
    expect(group.name).toBe("Grupo 3");
    expect(group.color).toBe("green");
    expect(posts(diagram).groupId).toBe(groupId);
    expect(diagram.tables[0]!.groupId).toBeUndefined();
  });
});

describe("tableIssues", () => {
  test("puts each problem next to the field it is about", () => {
    let diagram = blog();
    diagram = setColumnReference(diagram, "posts", "posts.author_id", {
      tableId: "users",
    });
    for (const op of [
      { type: "table.update", tableId: "posts", patch: { name: "users" } },
      {
        type: "column.update",
        tableId: "posts",
        columnId: "posts.id",
        patch: { primaryKey: false },
      },
      {
        type: "column.update",
        tableId: "posts",
        columnId: "posts.editor_id",
        patch: { name: "" },
      },
      {
        type: "column.update",
        tableId: "posts",
        columnId: "posts.author_id",
        patch: { type: "text" },
      },
    ] as const) {
      diagram = apply(diagram, op);
    }
    diagram = {
      ...diagram,
      tables: diagram.tables.map((t) =>
        t.id === "posts" ? { ...t, groupId: "gone" } : t,
      ),
    };

    const issues = tableIssues(diagram, validate(diagram), "posts");
    expect(issues.name.map((i) => i.code)).toEqual(["duplicate-table-name"]);
    expect(issues.group.map((i) => i.code)).toEqual(["table-missing-group"]);
    expect(issues.table.map((i) => i.code)).toEqual([
      "table-without-primary-key",
    ]);
    expect(issues.columns["posts.editor_id"]!.map((i) => i.code)).toEqual([
      "empty-column-name",
    ]);
    expect(issues.columns["posts.author_id"]!.map((i) => i.code)).toEqual([
      "relation-type-mismatch",
    ]);

    // The other table only gets its own problems.
    const users = tableIssues(diagram, validate(diagram), "users");
    expect(users.name.map((i) => i.code)).toEqual(["duplicate-table-name"]);
    expect(users.columns).toEqual({});
  });
});
