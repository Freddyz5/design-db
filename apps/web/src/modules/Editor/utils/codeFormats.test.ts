import { describe, expect, test } from "bun:test";
import { createDiagram, createExampleDiagram } from "@design-db/core";
import {
  clampCodeWidth,
  codeFileName,
  dialectChoices,
  formatLabel,
  generateCode,
} from "./codeFormats";

describe("generateCode", () => {
  const diagram = createExampleDiagram();

  test("writes the diagram in each format, for its dialect", () => {
    expect(generateCode(diagram, "sql")).toContain("CREATE TABLE users (");
    expect(generateCode(diagram, "sql")).toContain("CREATE TYPE post_status");
    expect(generateCode(diagram, "dbml")).toContain("Table users {");
    expect(generateCode(diagram, "drizzle")).toContain("pgTable(");
  });

  test("follows the dialect of the diagram", () => {
    const mysql = { ...diagram, dialect: "mysql" as const };
    expect(generateCode(mysql, "drizzle")).toContain("mysqlTable(");
    expect(generateCode(mysql, "sql")).not.toContain("CREATE TYPE");
  });
});

describe("formatLabel", () => {
  test("SQL names its dialect; DBML and Drizzle do not", () => {
    expect(formatLabel("sql", "postgres")).toBe("SQL · PostgreSQL");
    expect(formatLabel("sql", "generic")).toBe("SQL · SQL estándar");
    expect(formatLabel("dbml", "mysql")).toBe("DBML");
    expect(formatLabel("drizzle", "sqlite")).toBe("Drizzle");
  });
});

describe("dialectChoices", () => {
  test("offers PostgreSQL, MySQL and SQLite, and generic only when it is in use", () => {
    expect(dialectChoices("postgres")).toEqual(["postgres", "mysql", "sqlite"]);
    expect(dialectChoices("generic")).toEqual([
      "postgres",
      "mysql",
      "sqlite",
      "generic",
    ]);
  });
});

describe("clampCodeWidth", () => {
  test("keeps the width between a minimum and what leaves room for the canvas", () => {
    expect(clampCodeWidth(440.4, 1440)).toBe(440);
    expect(clampCodeWidth(100, 1440)).toBe(300);
    expect(clampCodeWidth(2000, 1440)).toBe(1080);
    expect(clampCodeWidth(500, 500)).toBe(300);
  });
});

describe("codeFileName", () => {
  test("uses the name of the diagram, without accents or spaces", () => {
    const diagram = createDiagram({ name: "Tienda en línea 2" });
    expect(codeFileName(diagram, "sql")).toBe("tienda-en-linea-2.sql");
    expect(codeFileName(diagram, "dbml")).toBe("tienda-en-linea-2.dbml");
  });

  test("Drizzle is always schema.ts, and a name with nothing usable becomes diagrama", () => {
    expect(codeFileName(createDiagram({ name: "Blog" }), "drizzle")).toBe(
      "schema.ts",
    );
    expect(codeFileName(createDiagram({ name: "¿?" }), "sql")).toBe(
      "diagrama.sql",
    );
  });
});
