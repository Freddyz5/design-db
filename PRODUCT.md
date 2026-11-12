# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Backend and full-stack developers who design or change the database schema of their own project before writing the migration.

## Product Purpose

Design DB is an open-source visual editor for entity-relationship diagrams. A developer builds a schema as a diagram, as code, or both, and takes the code back to their project.

The pilot succeeds when someone can build a diagram of three or four tables with groups and relations, edit it through the code, import an existing schema, and undo or redo any step.

## Positioning

- **Code and diagram at once.** SQL, DBML and Drizzle are edited in both directions: the diagram is another view of the same schema, not a drawing made from it.
- **Open source.** Free and open.

## Operating Context

- Runs in the browser, on the developer's machine.
- The pilot is local only: no login, no cloud, diagrams saved in the browser.
- A typical session starts from a schema that already exists: the developer pastes or drops `CREATE TABLE` statements, DBML, a Drizzle schema file or a project JSON, edits it, then copies or downloads the code.
- The editor is used with the keyboard as much as with the pointer.

## Capabilities and Constraints

- Tables, columns, relations (a relation is a foreign key; cardinality is derived from the columns; N:M is a join table), groups of tables with a color, and enums.
- Code panel in SQL (PostgreSQL, MySQL, SQLite), DBML and Drizzle, editable; import with "add" or "replace".
- Automatic layout, changes compared with a saved base, table search, undo and redo.
- The Drizzle reader reads declarations and never runs the code.
- Problems such as duplicate names are reported next to the affected field and do not block editing.
- Local only is the scope of the pilot, not a lasting principle: accounts and cloud saving are expected later as a normal part of the product.
- Interface terms (Spanish): tabla, columna, relación, grupo, enum, base, cambios.
- Undecided: license, and the public repository URL the landing page links to.

## Brand Commitments

- Name: **Design DB**.
- The interface is in Spanish.
- The mockup "Taller ER" is the reference for layout and behavior. Its name is not used and its colors are not final.
- Unconfirmed: voice. The mockup addresses the user as "tú", in short direct sentences.

## Evidence on Hand

- Reference mockup: https://claude.ai/artifact/3ZuyJxr1xteLCsvt6AJQ1M
- Example diagram shipped with the core (`createExampleDiagram` in `packages/core`).
- There are no users, testimonials, benchmarks or usage numbers yet. Do not invent them.

## Product Principles

1. The diagram and the code are the same schema; neither one is secondary.
2. Start from what the developer already has: importing a schema is a first-class way in.
3. Editing never gets blocked; problems are shown, not prevented.
4. Every change can be undone.
