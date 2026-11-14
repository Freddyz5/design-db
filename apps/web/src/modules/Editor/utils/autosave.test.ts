import { describe, expect, test } from "bun:test";
import { createAutosave, type SaveStatus, type Schedule } from "./autosave";

/** A clock the test moves by hand. */
function manualClock() {
  let pending: (() => void) | null = null;
  const schedule: Schedule = (run) => {
    pending = run;
    return () => {
      pending = null;
    };
  };
  return {
    schedule,
    tick: () => {
      const run = pending;
      pending = null;
      run?.();
    },
    get waiting() {
      return pending !== null;
    },
  };
}

function setup(save: (value: string) => Promise<unknown> = async () => {}) {
  const clock = manualClock();
  const saves: string[] = [];
  const statuses: SaveStatus[] = [];
  const autosave = createAutosave<string>({
    save: async (value) => {
      await save(value);
      saves.push(value);
    },
    onStatus: (status) => statuses.push(status),
    schedule: clock.schedule,
  });
  return { autosave, clock, saves, statuses };
}

describe("createAutosave", () => {
  test("saves the last value once the changes stop", async () => {
    const { autosave, clock, saves, statuses } = setup();
    autosave.reset("a", false);
    autosave.changed("b");
    autosave.changed("c");
    expect(saves).toEqual([]);
    clock.tick();
    await autosave.flush();
    expect(saves).toEqual(["c"]);
    expect(statuses.at(-1)).toBe("saved");
  });

  test("what was reset is not saved until it changes", async () => {
    const { autosave, clock, saves, statuses } = setup();
    autosave.reset("example", false);
    autosave.changed("example");
    expect(clock.waiting).toBe(false);
    await autosave.flush();
    expect(saves).toEqual([]);
    expect(statuses).toEqual(["idle", "saved"]);
  });

  test("going back to an older value after a save saves it again", async () => {
    const { autosave, saves } = setup();
    autosave.reset("a", true);
    autosave.changed("b");
    await autosave.flush();
    autosave.changed("a");
    await autosave.flush();
    expect(saves).toEqual(["b", "a"]);
  });

  test("a failed save says so and the next change tries again", async () => {
    let fail = true;
    const { autosave, saves, statuses } = setup(async () => {
      if (fail) throw new Error("disk full");
    });
    autosave.reset("a", true);
    autosave.changed("b");
    await autosave.flush();
    expect(statuses.at(-1)).toBe("error");
    fail = false;
    autosave.changed("c");
    await autosave.flush();
    expect(saves).toEqual(["c"]);
    expect(statuses.at(-1)).toBe("saved");
  });

  test("a change during a save stays pending", async () => {
    let release: () => void = () => {};
    const { autosave, statuses } = setup(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    autosave.reset("a", true);
    autosave.changed("b");
    const saving = autosave.flush();
    await Promise.resolve();
    autosave.changed("c");
    release();
    await saving;
    expect(statuses.at(-1)).toBe("pending");
  });
});
