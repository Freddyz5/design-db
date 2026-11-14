import { describe, expect, test } from "bun:test";
import { viewSummary } from "./viewSummary";

describe("viewSummary", () => {
  test("everything shown says nothing", () => {
    expect(viewSummary("all", "all")).toBe("");
  });

  test("names each filter that is not the default", () => {
    expect(viewSummary("keys", "all")).toBe("Claves");
    expect(viewSummary("all", "focus")).toBe("Enfoque");
    expect(viewSummary("name", "group")).toBe("Nombre, Grupo");
  });
});
