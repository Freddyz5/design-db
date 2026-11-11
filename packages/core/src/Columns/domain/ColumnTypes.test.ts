import { describe, expect, test } from "bun:test";
import { suggestedColumnTypes } from "./ColumnTypes";

describe("suggestedColumnTypes", () => {
  test("depends on the dialect", () => {
    expect(suggestedColumnTypes("postgres")).toContain("jsonb");
    expect(suggestedColumnTypes("mysql")).toContain("datetime");
    expect(suggestedColumnTypes("sqlite")).toEqual([
      "integer",
      "real",
      "text",
      "blob",
      "numeric",
    ]);
  });

  test("returns a copy that can be changed safely", () => {
    suggestedColumnTypes("generic").push("custom");
    expect(suggestedColumnTypes("generic")).not.toContain("custom");
  });
});
