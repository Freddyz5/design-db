# web

The website of Design DB: the landing at `/` and the diagram editor at `/app`. Astro with React islands and Tailwind 4; the data model comes from [`@design-db/core`](../../packages/core).

## Scripts

Run from this folder (or with `bun run <script>` from the repository root, through Turborepo):

```sh
bun run dev          # astro dev; use `astro dev --background` to keep it running
bun run build        # static build in dist/
bun run test         # bun test (store and pure logic)
bun run check-types  # tsc --noEmit
```

`astro check` does not support TypeScript 7 yet, so `check-types` uses `tsc`: the code inside `.astro` files is not type-checked (`src/env.d.ts` declares those modules).

## Structure

Organized with the repo-blueprints preset `ts-hexagonal`, variant `web-astro` (see `AGENTS.md` at the repository root).

```
src/
├── pages/            thin routes: index.astro (Landing), app.astro (Editor, client-only island)
├── layouts/          BaseLayout.astro: head, theme script, global styles
├── styles/global.css the theme: tokens with light-dark(), Tailwind @theme, fonts
├── content/site.json the site's text
└── modules/
    ├── Landing/      the landing: departures board fed by a live SQL demo
    ├── Editor/       the editor (one module; its zones share one store)
    │   ├── components/  bar, canvas, table-panel, code-panel, import
    │   ├── hooks/       EditorStore (Zustand + core history), useImport, useShortcuts…
    │   ├── utils/       pure logic with tests: canvas elements, edits, formats, layout…
    │   └── constants/   Spanish texts and fixed values
    └── shared/       what both modules use: the theme selector
```

## Editor

- **State.** `hooks/EditorStore.ts` keeps the core undo history. Every change goes through `dispatch(op)` (one operation) or `replace(diagram)` (several at once, an import, a code edit), and each is one undo step. Typing in a field is merged into one step with `mergeKey`; `checkpoint` closes it when the field loses focus. The view (selection, filters, open panels, notices) is apart and never enters the history.
- **Canvas.** React Flow with a custom table node (`canvas/TableNode.tsx`), relation edge (`canvas/RelationEdge.tsx`) and group region (`canvas/GroupNode.tsx`). `utils/canvasElements.ts` turns the diagram into nodes and edges, applying the view filters and the change marks. Dropping a table is one `layout.place`.
- **Code panel.** CodeMirror 6: official SQL, JavaScript in TypeScript mode for Drizzle, and an own DBML language (`utils/dbmlLanguage.ts`). Editing the code applies it with `importSchema` and `mergeDiagram(…, "replace")` once the user stops typing (`hooks/useCodeDraft.ts`).
- **Layout.** elkjs runs in a Web Worker (`utils/elkWorker.ts`); `utils/autoLayout.ts` lays out every table or only those without a position, with the sizes the canvas draws.
- **Theme.** Only tokens from `src/styles/global.css`; the default Tailwind palette is off. Light and dark come from the system unless `<html data-theme>` forces one.

## Keyboard

N new table · Enter edit the selected table · Supr delete · Ctrl/⌘ + Z undo · Ctrl/⌘ + Shift + Z redo · F show everything · / search · C code panel · ? help · Esc close or deselect. None of them fire while typing in a field, in the code or in a dialog.
