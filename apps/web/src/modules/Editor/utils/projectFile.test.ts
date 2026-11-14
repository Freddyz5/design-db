import { describe, expect, test } from "bun:test";
import { createExampleDiagram, importSchema } from "@design-db/core";
import { projectFile } from "./projectFile";

describe("projectFile", () => {
  test("is named after the diagram", () => {
    const diagram = { ...createExampleDiagram(), name: "Tienda en línea" };
    expect(projectFile(diagram).name).toBe("tienda-en-linea.design-db.json");
  });

  test("imports back as the same diagram", () => {
    const diagram = createExampleDiagram();
    const read = importSchema(projectFile(diagram).text);
    expect(read.ok && read.diagram).toEqual(diagram);
  });
});
