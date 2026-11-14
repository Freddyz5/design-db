// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // The editor island's dependencies, optimized up front. Left to be found
    // on the first load, Vite re-optimizes mid-page and React ends up twice.
    optimizeDeps: {
      include: [
        "react-dom/client",
        "@xyflow/react",
        "codemirror",
        "elkjs/lib/elk-api.js",
        "@codemirror/lang-javascript",
        "@codemirror/lang-sql",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/highlight",
        "lucide-react",
        "zustand",
        "zustand/vanilla",
      ],
      // SQLite loads its .wasm next to its own module: pre-bundled, it can't find it.
      exclude: ["@sqlite.org/sqlite-wasm"],
    },
    // The SQLite worker imports modules.
    worker: { format: "es" },
  },
});
