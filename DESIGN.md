---
name: Design DB
description: Open-source ER diagram editor drawn as an architectural blueprint of the database.
colors:
  canvas: "light-dark(#eff2f2, #101618)"
  grid: "light-dark(#e0e8e9, #161f21)"
  grid-major: "light-dark(#c4d5d7, #233236)"
  panel: "light-dark(#f7f9f9, #12191b)"
  raised: "light-dark(#ffffff, #172225)"
  line: "light-dark(#d5dfe0, #263437)"
  ink: "light-dark(#173a3f, #dde7e8)"
  ink-muted: "light-dark(#4f6b6f, #93a8ab)"
  bar: "light-dark(#1c3a3e, #131d20)"
  bar-deep: "light-dark(#142d31, #0c1416)"
  bar-well: "light-dark(#26464a, #1a272a)"
  bar-line: "light-dark(#3a585c, #2a393c)"
  bar-ink: "light-dark(#eff2f2, #dde7e8)"
  bar-muted: "light-dark(#adc0c2, #93a8ab)"
  bar-active: "light-dark(#7fe0e8, #4fd8e3)"
  bar-danger: "#ff8f80"
  accent: "light-dark(#e8590c, #ff8a3d)"
  on-accent: "light-dark(#ffffff, #131d20)"
  accent-ink: "light-dark(#c2410c, #ffa066)"
  sheet: "light-dark(#ffffff, #151f21)"
  sheet-ink: "light-dark(#173a3f, #dde7e8)"
  sheet-muted: "light-dark(#4f6b6f, #93a8ab)"
  sheet-rule: "light-dark(#d5dfe0, #263437)"
  sheet-edge: "light-dark(#173a3f, #7b9599)"
  sheet-head: "light-dark(#edf2f2, #1b2729)"
  sheet-head-ink: "light-dark(#173a3f, #c9d9db)"
  key: "light-dark(#fdeeb0, #363a2c)"
  key-ink: "light-dark(#6b4f00, #f6d36a)"
  relation: "light-dark(#4a686c, #8aa1a4)"
  relation-focus: "light-dark(#0e8c99, #4fd8e3)"
  added: "light-dark(#1b7f45, #4cc38a)"
  changed: "light-dark(#a16207, #e8b84a)"
  removed: "light-dark(#b3261e, #ff7b72)"
  group-1..8: "light-dark(muted ink, light ink): blue, green, red, purple, teal, amber, magenta, slate"
typography:
  display: "IBM Plex Sans Condensed 500/600/700"
  body: "IBM Plex Sans 400/500/600"
  mono: "IBM Plex Mono 400/500/600"
rounded:
  control: "3px"
  inner: "2px"
  sheet: "0"
---

# Design System: Design DB

## Overview

**Creative North Star: "Plano del esquema"**

The schema is a technical drawing. Tables are technical sheets inked on drawing paper with a cyan grid, groups are zones of the plan numbered as steps, relations are ink lines with crow's feet, and a title block in the corner says what the drawing is, its scale and when it was saved. The structure is the reference mockup's; the look is an architect's plan. The palette is «Tinta petróleo» (chosen 2026-11-14 from https://claude.ai/artifact/WuFfJB5dfnEmDTExmBBZGr). It replaces the earlier split-flap «Tablero de salidas», which the user rejected.

By day: petroleum ink on paper with a quiet cyan grid. At night: the same ink family on a dark sheet. Surfaces (canvas, grid, panels, bar, sheets, table headers, rules) keep the petroleum hue with little chroma, so the vivid cyan is left for what is on and never becomes the background (toned down on 2026-11-14 at the user's request: the saturated teal surfaces drowned the highlights). They stay tinted, never neutral graphite. Every color is written once with `light-dark()` in `apps/web/src/styles/global.css` and reaches Tailwind through `@theme static`; the default Tailwind palette is off.

It must not read like the references' defaults (dbdiagram's white SaaS with a blue accent, ChartDB's colorful cards, Liam's dark neon) or like a toy.

**Key characteristics:**

- Tables are flat technical sheets: 1.5px ink border, header on a tint of the group color, ruled rows of name / type / constraint, the primary key row in yellow highlighter.
- The canvas is drawing paper: a 20px cyan grid with a bolder line every 100px, both scaling with the zoom.
- Orange is the only pencil mark: primary action, selection, keyboard focus. Anything that is "on" (a chosen filter, a pressed toggle, a checked box, the table in focus) is cyan.
- A petroleum bar (48px in the editor, 56px on the landing) with the brand mark.
- IBM Plex: Sans Condensed caps for labels and titles (title-block lettering), Sans for controls and prose, Mono for identifiers, types and code.
- No decorative motion. State changes are instant; the only animation is the flash ring that says "here it is".

## Colors

### Ink and paper

- **Ink** (`ink`, `sheet-ink`, `sheet-edge`): text, table borders, relation lines. Petroleum by day; at night near-white for text and a soft light ink for table borders, so the cyan of the table in focus stands out.
- **Paper** (`canvas`, `sheet`, `panel`, `raised`): the canvas, the table sheets, the side panels, floating panels.
- **Grid** (`grid`, `grid-major`): the paper's two grids. Used only for the grid and the landing sheet.
- **Rules** (`line`, `sheet-rule`): hairlines between rows, cells and panels.

### Pencil and highlight

- **Orange** (`accent`, `accent-ink`, `on-accent`): the primary action («Importar», «Abrir el editor»), the selected table or relation, focus rings, the caret. Nothing else.
- **Cyan** (`relation-focus`, `bar-active`): the table in focus and its relations, the code lines of that table, checked boxes and radios, chosen filters and pressed toggles in the bar, foreign keys in the rows.
- **Yellow** (`key`, `key-ink`): primary key rows, like a highlighter stroke.

### Changes and groups

- **Changes** since the base: green new, amber changed, red removed.
- **Groups**: eight muted inks with a darker value for paper and a lighter one for night, or a color of one's own (hex), which is lightened 45% toward white at night so it reads there too. A table header is a 16% tint of its color with the name in the color mixed 70% with the sheet ink, so it reads in both themes; a group zone is a dashed outline at 75% and a 5% tint. A group's **intensity** (50–200%, stored as `intensity`, written to SQL as `-- @intensity`) scales them: header tint 5–32%, outline 55–100%, fill 1.5–14%.

## Typography

- **Display** (Plex Sans Condensed 700, caps, 0.02–0.04em): landing headline (clamp 40–84px), section titles (36px), dialog and empty-state titles (22–24px).
- **Brand** (Plex Sans Condensed 700, 18–20px, 0.14em, caps) with the brand mark.
- **Table name** (Plex Sans Condensed 700, 15.5px, 0.04em, real case).
- **Label** (Plex Sans Condensed 600, 10–12px, 0.1–0.14em, caps): column heads, field labels, title-block labels, panel headings.
- **Body / control** (Plex Sans 400–600, 13–21px).
- **Cell and code** (Plex Mono 11px in rows, 12.5–13px in code).

**The Real Case Rule.** Table and column names keep their real case everywhere; SQL identifiers can be case-sensitive. Caps belong to labels.

## Layout

The editor is a full-viewport instrument: the 48px bar on top, the gridded canvas left and the code panel right (about 70/30, resizable). On the canvas: zoom controls bottom-left, the title block bottom-right (hideable, remembered, hidden under 720px and while the legend is open), the selection bar top-center, notices bottom-center, the table panel at the side. Below 900px the code panel becomes a bottom sheet.

Tables are 300px wide with a 30px header and 24px rows. The landing is one column: a drawing sheet (ink border, inner frame, gridded paper) holding the headline, the editable SQL and the live tables with their own title block, then the same schema as DBML and Drizzle.

## Elevation

Drawings are flat. Tables carry no shadow; they are separated by their ink border. One soft shadow (`shadow-float`) lifts only what floats over the canvas: panels, menus, dialogs, notices, the title-block toggle.

## Components

- **Table sheet**: see Key characteristics. Selected: 2px orange outline with a soft orange halo. In focus: cyan outline. Others dim to 25% while a table is in focus.
- **Relation**: ink line, dashed when it crosses groups, crow's foot at the foreign key, two bars (or a bar and a circle when optional) at the parent. Cyan and thicker when its table is in focus, orange when selected. In focus it carries a **dimension mark**: the cardinality read from the foreign key (N : 1, 1 : 1, N : 0..1) in a small box with the ticks of a dimension line, at the middle of the curve.
- **Group zone**: dashed outline in its color, faint tint, big step number and the name in condensed caps. Over its name: «Color» (a panel with the eight swatches, a color of one's own and the intensity slider; a drag is one undo step), «Renombrar», «Desagrupar».
- **Title block**: four ruled rows (Plano, Escala as 1 : n and %, Contenido, Guardado) in an ink-bordered sheet.
- **Bar**: petroleum; brand mark, diagram name with «Mis diagramas» (new, duplicate, download, delete), save state | Importar, Nueva tabla, Ordenar | «Vista ▾» (columns and relations filters in a panel; the button names the active filters in cyan) and «Cambios» (split: toggles the marks with its count, the arrow opens the base; «Fijar base» while there is none) | search, code toggle, theme selector. It never scrolls: labels show from 1024px (the brand name from 1280px), icons below; under 640px the theme moves into «Vista».
- **Buttons**: 30px, 3px radius. Primary is orange; the rest are outlined on the bar or the paper.

## Do's and Don'ts

**Do:** keep orange for the one primary action and for selection and focus; use cyan for anything that is on; keep tables flat and ruled; let the grid show through group zones; keep names in their real case.

**Don't:** add graphite greys in the dark theme; put shadows on tables; use orange for toggles, checkboxes or filters; bring back the flap cascade; label every relation (dimension marks only in focus).
