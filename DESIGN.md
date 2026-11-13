---
name: Design DB
description: Open-source ER diagram editor where every table is a split-flap departures board.
colors:
  lamp: "#ffb000"
  on-lamp: "#0b0b0d"
  lamp-ink: "light-dark(#8a5200, #ffb000)"
  canvas: "light-dark(#dfe2e4, #1b1d20)"
  canvas-dot: "light-dark(#b4b9be, #34383d)"
  panel: "light-dark(#f6f7f8, #131517)"
  raised: "light-dark(#ffffff, #1e2124)"
  line: "light-dark(#c5c9cd, #2f3237)"
  ink: "light-dark(#0b0b0d, #eceded)"
  ink-muted: "light-dark(#565b61, #9a9fa6)"
  frame: "#16181b"
  frame-deep: "#0b0b0d"
  frame-well: "#23262a"
  frame-line: "#3a3e44"
  frame-ink: "#f2f2f2"
  frame-muted: "#a7aaaf"
  flap: "light-dark(#fbfbf9, #0b0b0d)"
  flap-ink: "light-dark(#0b0b0d, #f2f2f2)"
  flap-muted: "light-dark(#565b61, #a7aaaf)"
  flap-seam: "light-dark(#d9dde0, #1f2226)"
  flap-edge: "light-dark(#0b0b0d, #3a3e44)"
  key: "light-dark(#ffe680, #2a2408)"
  key-ink: "light-dark(#5c4a00, #ffd60a)"
  relation: "light-dark(#565b61, #8b9096)"
  added: "light-dark(#1b7f45, #4cc38a)"
  changed: "light-dark(#8a5200, #ffb000)"
  removed: "light-dark(#b3261e, #ff6b6b)"
  group-1: "#1f5fbf"
  group-2: "#1b7f45"
  group-3: "#a8341f"
  group-4: "#7446b8"
  group-5: "#0f7f86"
  group-6: "#a85a0a"
  group-7: "#b0307a"
  group-8: "#55606e"
  on-group: "#ffffff"
  code-keyword: "light-dark(#0b0b0d, #f2f2f2)"
  code-type: "light-dark(#0b6b74, #6fd3dc)"
  code-string: "light-dark(#2f6f37, #8fd694)"
  code-number: "light-dark(#6a3fb0, #c4a7f5)"
  code-selection: "light-dark(#ffe2a6, #4a3a10)"
  code-error: "light-dark(#f9dedc, #4a1f1c)"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.03em"
  flap-headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(26px, 4.2vw, 44px)"
    fontWeight: 600
    lineHeight: 1
  board-row:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "0.12em"
  brand:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "0.14em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "15.5px"
    fontWeight: 700
    letterSpacing: "0.06em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
  lead:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  control:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  cell:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
  code:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  none: "0px"
  inner: "2px"
  control: "3px"
  zone: "4px"
spacing:
  grid: "24px"
  row: "24px"
  strip: "30px"
  control: "30px"
  bar: "48px"
  bar-landing: "56px"
  table-width: "300px"
  page-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.lamp}"
    textColor: "{colors.on-lamp}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "{spacing.control}"
  button-bar:
    backgroundColor: "{colors.frame-well}"
    textColor: "{colors.frame-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "{spacing.control}"
  button-bar-pressed:
    backgroundColor: "{colors.frame-deep}"
    textColor: "{colors.lamp}"
  button-panel:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "{spacing.control}"
  input-panel:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "{spacing.control}"
  input-bar:
    backgroundColor: "{colors.frame-well}"
    textColor: "{colors.frame-ink}"
    rounded: "{rounded.control}"
    height: "{spacing.control}"
  segment-option-checked:
    backgroundColor: "{colors.frame-deep}"
    textColor: "{colors.lamp}"
    rounded: "{rounded.inner}"
    height: "28px"
  frame-bar:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.frame-ink}"
    height: "{spacing.bar}"
    padding: "0 16px"
  table-board:
    backgroundColor: "{colors.flap}"
    textColor: "{colors.flap-ink}"
    rounded: "{rounded.none}"
    width: "{spacing.table-width}"
  table-strip:
    backgroundColor: "{colors.group-1}"
    textColor: "{colors.on-group}"
    typography: "{typography.title}"
    height: "{spacing.strip}"
    padding: "0 8px"
  table-row:
    backgroundColor: "{colors.flap}"
    textColor: "{colors.flap-ink}"
    typography: "{typography.cell}"
    height: "{spacing.row}"
    padding: "0 5px"
  table-row-key:
    backgroundColor: "{colors.key}"
    textColor: "{colors.key-ink}"
  floating-panel:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# Design System: Design DB

## Overview

**Creative North Star: "Tablero de salidas"**

Every table is a departures board. Flap faces sit in fixed cells inside a steel hall, under a black frame bar, and the only thing that moves is the cell whose text changed. The developer reads the schema as a wall of boards and trusts that the diagram and the code say the same thing. The world comes from split-flap concourse signage: hard-edged faces, condensed capitals on the board's own labels, monospace identifiers, one amber lamp.

Density is high and calm. Boards are 300px wide with 24px rows, the canvas is a steel field with a 24px dot grid, and the chrome is thin and square-cornered. Day and night are the same object under different light: light flaps with black letters by day, black flaps (#0b0b0d) with white letters (#f2f2f2) at night. The frame bar stays black in both. Every color is written once with `light-dark()` in `apps/web/src/styles/global.css` and reaches Tailwind through `@theme static`; the default Tailwind palette is off.

It must not read as a generic SaaS panel (pastel rounded cards on a white dotted canvas with a blue accent) or as a toy.

Known gaps, deferred to a later polish phase. These are not rules, so do not copy their current state as the standard: landing board rows lack flap faces, the hall is flat steel rather than brushed steel, boards have no bezel depth, and text areas still show the browser's default resize grip.

**Key Characteristics:**

- Tables are technical sheets: a 1.5px edge, a header strip in the group colour, rows of name / type / detail, and the primary key row lit yellow.
- One amber lamp (#ffb000) for the primary action, selection and focus.
- A black frame bar (48px in the editor, 56px on the landing) in both themes.
- Barlow Condensed for the board's labels and names, Barlow for controls and prose, JetBrains Mono for identifiers, cells and code.
- Motion is the flap cascade only. Every other state change is instant.
- Square-cornered: 3px on controls, 2px inside them, 0 on boards.

## Colors

A steel-and-ink neutral world with one amber lamp, a yellow key highlight, a three-colour change code and eight deep group strips.

### Primary

- **Concourse Amber** (lamp): the only lamp. It fills the primary action (one per bar: Importar in the editor, Abrir el editor on the landing), marks a selected table with a 3px outline, lights the checked option of a segmented control and a pressed bar toggle, and colours selected relations. Text on it is **On-Lamp Black**.
- **Lamp Ink** (lamp-ink): amber made legible on the hall. Deep brown-amber by day, full amber at night. Used for focus outlines, the text caret, relation drag points, the active code tab's underline, and anything amber that must be read as text or as a hairline on a light surface.

### Secondary

- **Key Yellow** (key / key-ink): primary-key rows only. Butter yellow face with dark olive text by day; a dark olive face with bright yellow text at night.

### Tertiary

- **Change Code** (added / changed / removed): green for what is new, the board's delay amber for what changed, red for what was deleted (struck through). Removed also carries errors, and added the healthy status dot.
- **Group Strips** (group-1 to group-8: blue, green, red, purple, teal, amber, magenta, slate): deep line colours that hold white condensed type (on-group) in both themes. On the canvas a group zone is its colour at 9% fill with a 60% border. Imported hex colours get black or white ink by luminance (threshold 0.3). A table with no group gets the flap-edge strip.
- **Code Syntax** (code-type teal, code-string green, code-number violet): muted and theme-paired. Keywords are bold ink (code-keyword), not a colour.

### Neutral

- **Steel Hall** (canvas, canvas-dot): the canvas and landing background, with a 24px dot grid.
- **Panel Steel** (panel) and **Raised Steel** (raised): the code panel, dialogs and inspectors (panel), and floating bars, inputs and buttons on them (raised).
- **Hairline** (line): every 1px border in the hall.
- **Ink / Muted Ink** (ink, ink-muted): text on the hall.
- **Frame Black family** (frame, frame-deep, frame-well, frame-line, frame-ink, frame-muted): the bar, header rows of the landing board, the footer and notices. Fixed values with no theme pair.
- **Flap family** (flap, flap-ink, flap-muted, flap-seam, flap-edge): board faces, their letters, the seams between rows and cells, and the outer edge.
- **Relation Steel** (relation): relation lines and crow's feet at rest.

### Named Rules

**The One Lamp Rule.** Amber means "act here, this is selected, this has focus". Nothing decorative is amber. The one cited exception is the board's delay amber (changed) in the changes view. On the landing, amber also marks the cursor and rows that are arriving.

**The Ink Keyword Rule.** Code keywords are bold ink (weight 600), never amber. Code colour stays out of the lamp's channel.

**The Written-Once Rule.** A colour is declared once as `light-dark(day, night)` in global.css and used through its token. No raw hex in components except the group-strip ink fallback for imported colours.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif), weights 500 / 600 / 700
**Body Font:** Barlow (with ui-sans-serif, system-ui), weights 400 / 500 / 600
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, SFMono-Regular, Menlo)

**Character:** Condensed grotesque capitals do what signage does: long names fit in a fixed cell and labels read from a distance. Monospace carries anything that is literally schema, so identifiers align and never get restyled.

### Hierarchy

- **Flap headline** (600, clamp(26px, 4.2vw, 44px), 1): one character per flap cell. Only the landing board's headline.
- **Display** (700, 36px, 1, 0.03em, caps): section titles on the landing. In the editor, dialog and empty-state titles use the same voice at 22–24px with 0.04em.
- **Board row** (600, 26px, 0.12em, caps; 19px under 720px): rows of the landing departures board.
- **Brand** (700, 18px in the bar, 20px on the landing, 0.14em, caps): the "DESIGN DB" wordmark.
- **Title** (700, 15.5px, 0.06em, real case): the table name on its header strip. Group zone names are 20px at 0.08em.
- **Lead / Body** (400, 21px / 17px / 14px, 1.45): landing lead, landing body and the app's base (tabular numerals on).
- **Control** (500, 13px; primary 600): bar and panel buttons, inputs. Segmented options are 12.5px.
- **Label** (600, 11.5–13px, 0.08em, caps): field labels, panel headings, code tabs (0.06em), board column heads (0.14em).
- **Cell** (400, 11px mono): column rows on a board. Flags (PK, UQ, NULL) switch to condensed 600 at 0.08em.
- **Code** (400, 12.5px mono, 1.55): the code panel, import text area and landing code blocks (13px).

### Named Rules

**The Real Case Rule.** Table and column names keep their real case wherever they appear in the editor: on the strip, in rows, in panel headers. SQL identifiers can be case-sensitive, so the board must not misstate the schema. Condensed caps belong to board-level labels: column heads, field labels, tabs, status words, the wordmark.

**The Fixed Cell Rule.** Identifiers, types, counts and zoom percentages are monospace or tabular, so a changed value flips in place and does not reflow its neighbours.

## Layout

The editor is a full-viewport instrument. The 48px frame bar runs across the top. Under it the steel canvas takes the left and the code panel the right (about 70/30, with a resizable splitter). Floating pieces sit on the canvas at fixed anchors: zoom controls bottom-left, the selection bar top-center, notices bottom-center, the table inspector (400px) and changes list (300px) at the side. Below 900px the code panel becomes a bottom sheet at 55% height. On narrow windows bar labels collapse to icons (below 1600px) and the tool row scrolls sideways with a 40px edge fade. Below 720px the table search hides, and below 560px the wordmark does.

Boards are fixed-size cells: 300px wide, a 30px strip, 24px rows, and columns at 31% / 31% / 38% for name / type / detail. Canvas dots sit on a 24px pitch, matching the row height.

The landing is a single column with 40px gutters (16px under 720px), 36px top padding and the same steel dot field. The departures board spans full width. Under it the pitch and the editable SQL split 1fr / 560px, stacking under 960px. Prose measure is 56–66ch.

Controls are 30px tall in the bar and the panels, segmented options 28px, and icon buttons 28px square. Gaps follow a 4px rhythm (4, 6, 8, 12, 24).

## Elevation & Depth

Depth is mostly structural: hairlines, seams and the contrast between the black frame, the steel hall and the flap faces. One soft shadow lifts anything that floats over the canvas. Boards carry it too, so they read as objects mounted in the hall. The landing board is framed by a flat 6px bezel ring in frame-well, not a shadow.

### Shadow Vocabulary

- **Float** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.14), 0 10px 24px rgb(0 0 0 / 0.16)`): boards, floating panels and bars, the notice, popovers, dialogs, and the code sheet on narrow screens.
- **Bezel ring** (`box-shadow: 0 0 0 6px var(--color-frame-well)`): the landing departures board.
- **Row seam** (`box-shadow: inset 0 1px 0 var(--color-flap-seam)`): the top edge of each landing board row.
- **Active tab rule** (`box-shadow: inset 0 -2px 0 var(--color-lamp-ink)`): the selected code tab.

### Named Rules

**The One Shadow Rule.** There is exactly one drop shadow (float). Do not add a second elevation step. Rank comes from the frame, hall and flap materials.

## Shapes

Square-cornered hardware. Boards have no radius and a 1.5px edge (flap-edge: black by day, steel at night). Controls, panels, dialogs and inputs use 3px (control). Elements nested inside a control (segment options, inline panel buttons, flap cells) use 2px (inner). Group zones on the canvas use 4px. Rows and cells inside a board are divided by 1px flap-seam lines. Change lamps are 6px squares. Status dots are the only circles (7px). Relations cross groups as 5/4 dashed lines and end in crow's feet.

## Components

### Buttons

Compact, flat and bordered, like switches on a console.

- **Shape:** gently squared (3px), 30px tall, 11px side padding, 1px border.
- **Primary:** amber fill and border with on-lamp text at weight 600. One per surface. On the landing it grows to 40px (bar) or 48px with 17px text.
- **Bar (secondary):** frame-well fill, frame-line border, frame-ink text at 500. Hover lightens the border to frame-muted. A pressed toggle (Código, Cambios) turns frame-deep with amber text.
- **Panel:** raised fill, hairline border, ink text. Hover darkens the border to ink-muted. Destructive actions keep this shape with removed-colour text.
- **Hover / Focus:** primary hover is brightness 105%. Focus is a 2px lamp-ink outline offset 2px (lamp on the black bar). Disabled is 45% opacity. No transitions.

### Segmented controls

- **Style:** a frame-well track with a frame-line border and 1px padding. Options are 28px with 2px corners and frame-muted text.
- **State:** the checked option takes a frame-deep fill with amber text. Hover brings the text to frame-ink. The theme selector (light / dark / system) is the icon-only version.

### Cards / Containers

- **Corner Style:** 3px for floating panels and dialogs. Boards are square.
- **Background:** panel for inspectors, the changes list and dialogs; raised for small floating bars and popovers.
- **Shadow Strategy:** float (see Elevation & Depth).
- **Border:** 1px hairline. Headers are split from the body by a hairline, carry a condensed caps label, and close with a 28px icon button.
- **Internal Padding:** 12–14px for inspectors, 20px for dialogs, 24px for the empty state.

### Inputs / Fields

- **Style:** 30px, raised fill, hairline border, 3px corners, 13px text, muted placeholder. On the bar, search uses frame-well and frame-line.
- **Labels:** condensed caps (11.5px, 600, 0.08em) in ink-muted, above the control.
- **Focus:** the global 2px lamp-ink outline. The code editor draws it inset (-2px).
- **Error / Warning:** an invalid input gets a removed border. Messages sit under the field, errors in removed and warnings in changed. Editing is never blocked.

### Navigation

- **Frame bar:** black (frame) with a frame-deep bottom border. Left to right: wordmark, the diagram name in a frame-well chip (condensed 15px, 600), Nuevo, a 1px frame-line divider, then the amber primary and the tools in divider-separated clusters. Search, code toggle and theme sit on the right. Icons are Lucide at 15px with stroke 1.75.
- **Code tabs:** condensed caps 13px. The selected tab gets a canvas fill, ink text and a 2px lamp-ink underline.

### Board (Signature Component)

A table on the canvas: a 300px flap face with a 1.5px edge and the float shadow. The 30px strip holds the real-case table name in condensed 700 on the group colour, plus a mono column count at 80% opacity. Rows are 24px mono cells for name / type (flap-muted) / detail. The detail cell holds condensed flags (PK, UQ, NULL) and `→ table.column` references. The PK row is key yellow with key-ink detail. In the changes view, a changed column gets a 6px square lamp (added or changed) before its name, a removed column is struck through in removed with an "ELIMINADA" tag, and the strip carries a "NUEVA" / "CAMBIÓ" tag. Selection is a 3px amber outline. Dimmed boards drop to 30% opacity. Relation drag points (11px, lamp-ink border) appear on hover.

### Flap Cascade (Signature Motion)

When a cell's text changes (an edit, a code update, undo), its characters flip one after another: 160ms each, `steps(4, end)`, rotateX 90° to 0° from 20% opacity, with a 22ms stagger per character. It never runs on first render, except a landing row that is arriving. Under reduced motion the text simply changes. Until its first change a cell renders as plain text, so large diagrams stay cheap. A headline set in flaps always draws one bordered 2px cell per character, with a seam across the middle. Everything else changes state instantly. The only other motion is zoom and fit (150–200ms, zero under reduced motion) and 100–150ms opacity reveals for hover actions and dimming.

### Notice

A frame-black strip at the bottom-center with a 13px message and an amber "Deshacer" text button. It closes by itself after 8 seconds.

## Do's and Don'ts

### Do:

- **Do** keep tables as technical sheets: 1.5px edge, group-colour strip, name / type / detail rows, PK row in key yellow.
- **Do** keep the frame bar black (#16181b) in both themes, and flip only the flaps and the hall between day and night.
- **Do** use exactly one amber primary action per surface, and amber for selection and focus.
- **Do** set table and column names in their real case and monospace in rows. Use condensed caps only for board-level labels.
- **Do** declare every new colour once with `light-dark()` in global.css and use it through its token.
- **Do** animate text changes with the flap cascade and nothing else. Honour reduced motion.
- **Do** keep boards at 300px with 24px rows, so cells stay fixed.

### Don't:

- **Don't** use amber for decoration, code keywords, headings or status. The only cited exception is the delay amber for "changed".
- **Don't** let the interface drift into a generic SaaS panel (pastel rounded cards, white dotted canvas, blue accent) or into a toy.
- **Don't** uppercase or restyle SQL identifiers in the editor.
- **Don't** add easing-in entrances, slide-ins or a second drop shadow.
- **Don't** round boards, or give controls more than 3px.
- **Don't** use the default Tailwind palette. It is turned off.
