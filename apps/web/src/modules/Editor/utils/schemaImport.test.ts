import { describe, expect, test } from "bun:test";
import { createDiagram, createExampleDiagram, toDbml } from "@design-db/core";
import { previewImport, runImport } from "./schemaImport";

const SQL = `CREATE TABLE users (
  id int PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE
);
CREATE TABLE orders (
  id int PRIMARY KEY,
  user_id int NOT NULL REFERENCES users (id)
);`;

describe("previewImport", () => {
  test("says the format, the tables, the relations and how many already exist", () => {
    const preview = previewImport(createExampleDiagram(), SQL);
    expect(preview).toMatchObject({
      ok: true,
      format: "sql",
      tables: 2,
      relations: 1,
      groups: 0,
      existing: 1,
    });
  });

  test("detects DBML and its groups", () => {
    const dbml = toDbml(createExampleDiagram());
    expect(previewImport(createDiagram(), dbml)).toMatchObject({
      ok: true,
      format: "dbml",
      tables: 5,
      groups: 2,
      existing: 0,
    });
  });

  test("errors come with their line; a text without tables is an error too", () => {
    const broken = previewImport(createDiagram(), "CREATE TABLE (");
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.errors[0]!.line).toBe(1);

    const empty = previewImport(createDiagram(), "-- nothing here");
    expect(empty).toMatchObject({
      ok: false,
      errors: [{ message: "No hay tablas en el texto." }],
    });
  });
});

describe("runImport", () => {
  test("adding keeps the diagram and brings the new tables without a position", () => {
    const current = createExampleDiagram();
    const outcome = runImport(current, SQL, "add")!;
    // users is taken, so it comes in as users_2.
    const names = outcome.diagram.tables.map((t) => t.name);
    expect(names).toContain("users_2");
    expect(names).toContain("orders");
    expect(outcome.diagram.tables).toHaveLength(current.tables.length + 2);
    expect(outcome.imported).toHaveLength(2);
    expect(outcome.unplaced.sort()).toEqual([...outcome.imported].sort());
    expect(outcome.notice).toBe("Agregaste 2 tablas desde SQL.");
  });

  test("replacing leaves only what was imported, and keeps the tables that existed", () => {
    const current = createExampleDiagram();
    const users = current.tables.find((t) => t.name === "users")!;
    const outcome = runImport(current, SQL, "replace")!;
    expect(outcome.diagram.tables.map((t) => t.name)).toEqual([
      "users",
      "orders",
    ]);
    expect(outcome.diagram.tables[0]!.id).toBe(users.id);
    expect(outcome.diagram.layout.tables[users.id]).toEqual(
      current.layout.tables[users.id],
    );
    expect(outcome.unplaced).toEqual([outcome.diagram.tables[1]!.id]);
    expect(outcome.notice).toBe("Importaste 2 tablas desde SQL; 1 ya existía.");
  });

  test("an empty diagram takes the name and the dialect of what was imported", () => {
    const dbml = toDbml(createExampleDiagram());
    const outcome = runImport(
      createDiagram({ name: "Sin título" }),
      dbml,
      "add",
    )!;
    expect(outcome.diagram.name).toBe("Blog");
    expect(outcome.diagram.dialect).toBe("postgres");
  });

  test("a diagram with tables keeps its name and its dialect", () => {
    const current = {
      ...createExampleDiagram(),
      name: "Mío",
      dialect: "mysql" as const,
    };
    const outcome = runImport(
      current,
      toDbml(createExampleDiagram()),
      "replace",
    )!;
    expect(outcome.diagram.name).toBe("Mío");
    expect(outcome.diagram.dialect).toBe("mysql");
  });

  test("the project JSON keeps its positions", () => {
    const example = createExampleDiagram();
    const outcome = runImport(
      createDiagram(),
      JSON.stringify(example),
      "replace",
    )!;
    expect(outcome.unplaced).toEqual([]);
    expect(outcome.diagram.tables).toHaveLength(example.tables.length);
  });

  test("nothing to import gives null", () => {
    expect(runImport(createDiagram(), "CREATE TABLE (", "add")).toBeNull();
    expect(runImport(createDiagram(), "", "add")).toBeNull();
  });
});
