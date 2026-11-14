/** What the bar says about saving. */
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/** Runs `run` after `ms` and returns how to cancel it. Injected so tests control time. */
export type Schedule = (run: () => void, ms: number) => () => void;

export type Autosave<T> = {
  /** The value changed: save it once it stops changing for a moment. */
  changed: (value: T) => void;
  /** Saves now what is waiting, if anything. Resolves when every save so far is done. */
  flush: () => Promise<void>;
  /** Starts over with `value` as what is stored (`stored`) or as something not worth saving until it changes. */
  reset: (value: T, stored: boolean) => void;
  dispose: () => void;
};

const browserSchedule: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

/**
 * Saves the latest value a moment after the last change, one save at a time.
 * A value equal (same reference) to the last one saved is not saved again,
 * so loading a diagram or leaving the example untouched writes nothing.
 */
export function createAutosave<T>(options: {
  save: (value: T) => Promise<unknown>;
  onStatus: (status: SaveStatus) => void;
  delay?: number;
  schedule?: Schedule;
}): Autosave<T> {
  const { save, onStatus, delay = 900, schedule = browserSchedule } = options;
  let saved: T | undefined;
  let latest: T | undefined;
  /** The value last sent to `save`, saved or still on its way. */
  let queued: T | undefined;
  let cancel: (() => void) | null = null;
  let chain: Promise<void> = Promise.resolve();

  const stopTimer = () => {
    cancel?.();
    cancel = null;
  };

  const flush = (): Promise<void> => {
    stopTimer();
    if (latest === undefined || latest === saved || latest === queued) {
      return chain;
    }
    const value = latest;
    queued = value;
    onStatus("saving");
    chain = chain.then(async () => {
      try {
        await save(value);
        saved = value;
        onStatus(latest === value ? "saved" : "pending");
      } catch {
        queued = saved;
        onStatus("error");
      }
    });
    return chain;
  };

  return {
    changed(value) {
      latest = value;
      stopTimer();
      if (value === saved) {
        onStatus("saved");
        return;
      }
      onStatus("pending");
      cancel = schedule(() => void flush(), delay);
    },
    flush,
    reset(value, stored) {
      stopTimer();
      saved = value;
      latest = value;
      queued = value;
      onStatus(stored ? "saved" : "idle");
    },
    dispose: stopTimer,
  };
}
