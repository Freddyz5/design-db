import ELK from "elkjs/lib/elk-api.js";
import workerUrl from "elkjs/lib/elk-worker.min.js?url";
import type { Layouter } from "./autoLayout";

let elk: InstanceType<typeof ELK> | null = null;

/** elkjs running in a Web Worker, so laying out a big diagram never freezes the page. Created on first use. */
export function browserLayouter(): Layouter {
  elk ??= new ELK({ workerFactory: () => new Worker(workerUrl) });
  return elk;
}
