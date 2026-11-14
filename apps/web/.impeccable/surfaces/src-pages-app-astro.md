---
version: 1
slug: "src-pages-app-astro"
primary_target: "src/pages/app.astro"
related_targets: ["src/modules/Editor","src/styles/global.css"]
---

# Editor (`/app`)

## Scope

The diagram editor, mounted at `/app` as a client-only React island. Visitor mode: **Operate**. Its theme (tokens, type, light and dark) is shared with the landing at `/`.

## Task

A developer builds or changes a schema: tables on a canvas, relations between them, and the same schema as SQL, DBML or Drizzle in a side panel. Sessions are long and keyboard-heavy. Layout and behavior follow the reference mockup: top bar, canvas, code panel on the right, floating table inspector.

## Constraints

- Tables are technical sheets: ink border, tinted header, rows of name / type / detail, primary key highlighted in yellow. Pinned by the user.
- Eight group colors. Light and dark themes with a selector: light, dark or system.
- Must not read as a generic SaaS dashboard or as a toy.
- Interface in Spanish. Controls are standard web controls.

## Direction contract

THESIS: The schema is a technical drawing. Tables are technical sheets inked on drawing paper with a cyan grid, under a title block, so the diagram reads like an architect's plan of the database. It refuses the category defaults seen in the references (dbdiagram's white SaaS with a blue accent, ChartDB's colorful cards, Liam's dark neon) and the previous split-flap board, which the user rejected on 2026-11-14.

OWN-WORLD: Petroleum ink `#123c42` on paper `#edf3f2` with a cyan grid (minor `#d2e6e6` every 20px, major `#a6cdd0` every 100px) by day; at night the same ink family on a dark sheet `#0e1a1c`, with cyan and petroleum tints for the bar, table headers, rules and lines, never graphite greys. Orange `#e8590c` (night `#ff8a3d`) is the only pencil mark: primary action, selection, focus. Yellow highlighter marks primary keys, green what is new, red what was deleted, amber what changed. Tables: ink border, tinted header, rows of name / type / detail in a ruled grid; names keep their real case. Groups: dashed outline in the group color with a big step number. A hideable title block (cajetín) in the corner holds name, scale (zoom), size and save date. Relations: ink lines with crow's feet, dashed across groups, cyan when focused; the focused table's relations show a dimension mark with their cardinality. IBM Plex Sans Condensed in uppercase with tracking for labels and titles (title-block lettering), IBM Plex Sans for controls, IBM Plex Mono for identifiers, types and code.

STORY: The developer opens their schema and reads it like a plan: sheets, groups numbered as steps, a title block saying what and when. They change one thing and the drawing and the code still agree.

FIRST VIEWPORT: Petroleum bar (48px) across the top with the name, diagram title with «Mis diagramas», save state and tools; orange primary action. Below it the gridded canvas takes the left 70%, the code panel the right 30%. Zoom controls float bottom-left; the title block bottom-right; the selection toolbar top-center.

FORM: architectural blueprint applied to the reference mockup's structure (user's direction, 2026-11-14; palette «Tinta petróleo» chosen from https://claude.ai/artifact/WuFfJB5dfnEmDTExmBBZGr). Motion grammar: instant state changes; no flap cascade, no easing-in entrances.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- None. Resolved on 2026-11-14: title block wanted and hideable; dimension marks only on the focused table's relations.
