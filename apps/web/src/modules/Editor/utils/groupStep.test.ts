import { describe, expect, test } from "bun:test";
import { groupStep } from "./groupStep";

describe("groupStep", () => {
  test("reads the number and the title of a step", () => {
    expect(groupStep("Paso 1 · Catálogo")).toEqual({
      number: 1,
      title: "Catálogo",
    });
    expect(groupStep("step 12: Orders")).toEqual({
      number: 12,
      title: "Orders",
    });
    expect(groupStep("Fase 2 - Ventas")).toEqual({
      number: 2,
      title: "Ventas",
    });
    expect(groupStep("ETAPA 3 — Pagos")).toEqual({ number: 3, title: "Pagos" });
  });

  test("any other name is not a step", () => {
    expect(groupStep("Accounts")).toBeNull();
    expect(groupStep("Paso a paso")).toBeNull();
    expect(groupStep("Paso 1")).toBeNull();
  });
});
