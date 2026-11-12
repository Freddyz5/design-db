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

- Tables are technical sheets: dark border, header in the group color, rows of name / type / detail, primary key highlighted in yellow. Pinned by the user.
- Eight group colors. Light and dark themes with a selector: light, dark or system.
- Must not read as a generic SaaS dashboard or as a toy.
- Interface in Spanish. Controls are standard web controls.

## Direction contract

THESIS: Every table is a departures board: black flap faces, white letters in fixed cells, and nothing moves except the cell that changed. It refuses the category default of pastel rounded cards on a white dotted canvas with a blue accent.

OWN-WORLD: Flap black `#0b0b0d` boards with letter white `#f2f2f2`, on a brushed-steel hall (light steel by day, dark steel at night) under a black frame bar. Amber `#ffb000` is the only lamp: primary action, selection, focus. Yellow marks primary keys, red cancels what was deleted, green marks what is new. Group headers are deep line-color strips with white condensed caps. Barlow Condensed for names and labels, Barlow for controls, JetBrains Mono for identifiers and code.

STORY: The developer sees their schema as a wall of boards they can read from across the room, changes one thing, and watches only that cell flip. They trust that the diagram and the code say the same thing.

FIRST VIEWPORT: Black frame bar (48px) across the top with the name, diagram title and tools, amber primary action at the left of the tools. Below it the steel canvas takes the left 70%, with the boards (280px wide, 24px rows) inside outlined group zones; relations are thin steel lines with crow's feet. The code panel takes the right 30%. Zoom controls float bottom-left; the selection toolbar floats top-center.

FORM: split-flap departures board, adopted by the user from the dealt challengers (catalog `signals-instruments-split-flap-concourse`); it was not on the grounded list. seed:704b7581522daa7a. Signature interaction: the flap cascade. When a cell's text changes (an edit, a code update, undo), its characters flip one after another; under reduced motion the text just changes. Motion grammar: instant state changes everywhere else; no easing-in entrances.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Whether boards stay black in the light theme or invert to light flaps. Proposed: stay black.
