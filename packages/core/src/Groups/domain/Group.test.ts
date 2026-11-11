import { describe, expect, test } from "bun:test";
import { createGroup, GroupSchema, patchGroup } from "./Group";

describe("createGroup", () => {
  test("has a name and leaves color and note out", () => {
    const group = createGroup({ name: "Billing" });
    expect(group.name).toBe("Billing");
    expect("color" in group).toBe(false);
    expect("note" in group).toBe(false);
    expect(GroupSchema.safeParse(group).success).toBe(true);
  });

  test("each group gets its own id", () => {
    expect(createGroup().id).not.toBe(createGroup().id);
  });
});

describe("patchGroup", () => {
  test("changes the given fields and removes optional ones", () => {
    const group = Object.freeze(createGroup({ name: "a", color: "teal" }));
    const renamed = patchGroup(group, { name: "b", note: "x" });
    expect(renamed).toEqual({ ...group, name: "b", note: "x" });
    expect("color" in patchGroup(group, { color: undefined })).toBe(false);
  });
});
