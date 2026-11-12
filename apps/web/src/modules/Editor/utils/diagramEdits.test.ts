import { describe, expect, test } from "bun:test";
import {
  apply,
  createColumn,
  createDiagram,
  createGroup,
  createRelation,
  createTable,
  type Diagram,
} from "@design-db/core";
import {
  createDefaultTable,
  freePosition,
  nextTableName,
  removeTables,
  setTablesGroup,
} from "./diagramEdits";

function diagramWith(...names: string[]): Diagram {
  let diagram = createDiagram();
  names.forEach((name, index) => {
    diagram = apply(diagram, {
      type: "table.add",
      table: createTable({
        id: name,
        name,
        columns: [
          createColumn({ id: `${name}.id`, name: "id", primaryKey: true }),
        ],
      }),
      position: { x: index * 400, y: 0 },
    });
  });
  return diagram;
}

describe("nextTableName", () => {
  test("numbers from the amount of tables", () => {
    expect(nextTableName(diagramWith())).toBe("tabla_1");
    expect(nextTableName(diagramWith("users", "posts"))).toBe("tabla_3");
  });

  test("skips the names in use, whatever their case", () => {
    expect(nextTableName(diagramWith("users", "Tabla_3", "tabla_4"))).toBe(
      "tabla_5",
    );
  });
});

describe("createDefaultTable", () => {
  test("has a free name and an id primary key", () => {
    const table = createDefaultTable(diagramWith("users"));
    expect(table.name).toBe("tabla_2");
    expect(table.columns).toHaveLength(1);
    expect(table.columns[0]).toMatchObject({
      name: "id",
      type: "int",
      primaryKey: true,
      autoIncrement: true,
      nullable: false,
    });
  });
});

describe("freePosition", () => {
  test("keeps the wanted spot when it is free, rounded", () => {
    expect(freePosition(diagramWith("users"), { x: 200.4, y: 99.6 })).toEqual({
      x: 200,
      y: 100,
    });
  });

  test("steps down and right until no table starts there", () => {
    const diagram = apply(diagramWith("users"), {
      type: "table.add",
      table: createTable({ id: "posts", name: "posts" }),
      position: { x: 24, y: 24 },
    });
    expect(freePosition(diagram, { x: 0, y: 0 })).toEqual({ x: 48, y: 48 });
    expect(freePosition(diagram, { x: 10, y: 10 })).toEqual({ x: 58, y: 58 });
  });
});

describe("removeTables", () => {
  test("removes the tables and the relations that used them", () => {
    const diagram = apply(diagramWith("users", "posts", "tags"), {
      type: "relation.add",
      relation: createRelation({
        from: { tableId: "posts", columnIds: ["posts.id"] },
        to: { tableId: "users", columnIds: ["users.id"] },
      }),
    });
    const next = removeTables(diagram, ["users", "tags"]);
    expect(next.tables.map((table) => table.name)).toEqual(["posts"]);
    expect(next.relations).toEqual([]);
    expect(Object.keys(next.layout.tables)).toEqual(["posts"]);
  });

  test("returns the same diagram when there is nothing to remove", () => {
    const diagram = diagramWith("users");
    expect(removeTables(diagram, [])).toBe(diagram);
  });
});

describe("setTablesGroup", () => {
  const grouped = () =>
    apply(diagramWith("users", "posts"), {
      type: "group.add",
      group: createGroup({ id: "accounts", name: "Accounts" }),
    });

  test("puts the tables in the group, and takes them out", () => {
    const inGroup = setTablesGroup(grouped(), ["users", "posts"], "accounts");
    expect(inGroup.tables.map((table) => table.groupId)).toEqual([
      "accounts",
      "accounts",
    ]);

    const out = setTablesGroup(inGroup, ["users"], undefined);
    expect(out.tables.map((table) => table.groupId)).toEqual([
      undefined,
      "accounts",
    ]);
  });
});
