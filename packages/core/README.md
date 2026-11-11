# @design-db/core

The data model of Design DB: what a diagram is and how it changes. Plain TypeScript, with no UI and no database, so the editor and storage share the same code.

## Ideas

- **Ids, not names.** Tables, columns and relations have a stable id, so renaming never breaks a relation.
- **A relation is a foreign key.** `from` is the child table (holds the foreign key), `to` is the parent. Cardinality is worked out from the columns (`unique` → 1:1, otherwise 1:N; `nullable` → optional), so it can't contradict them. N:M is a join table, created with `createManyToMany`.
- **Schema and layout are separate.** Positions, colors and the viewport live in `diagram.layout`.
- **Operations are pure.** `apply(diagram, op)` returns a new diagram and never modifies the old one. That makes undo trivial.
- **Operations keep ids consistent; `validate` reports the rest.** Applying an operation that points at something missing throws `OperationError`. Problems like duplicate names don't block editing: `validate` lists them as errors or warnings.

## Usage

```ts
import {
  apply,
  createColumn,
  createDiagram,
  createHistory,
  createTable,
  pushOp,
  undo,
  validate,
} from "@design-db/core";

let diagram = createDiagram({ name: "Shop" });

const users = createTable({
  name: "users",
  columns: [createColumn({ name: "id", type: "int", primaryKey: true })],
});
diagram = apply(diagram, {
  type: "table.add",
  table: users,
  position: { x: 0, y: 0 },
});

validate(diagram); // [] → no problems

// With undo/redo
let history = createHistory(diagram);
history = pushOp(history, {
  type: "table.move",
  tableId: users.id,
  position: { x: 100, y: 50 },
});
history = undo(history); // back to { x: 0, y: 0 }
```

Saving and loading: the diagram is plain JSON. Use `parseDiagram(JSON.parse(text))` to check a loaded file.

## Structure

Organized with the repo-blueprints preset `ts-hexagonal`, variant `core` (see `.blueprint.json` at the repository root). One folder per concept; each exposes its public API in `index.ts`, and other modules import only from there.

```
src/
├── index.ts        re-exports every module
├── shared/         used by two or more modules: Id, DomainError/OperationError, applyPatch
├── Columns/        Column: shape, createColumn, patchColumn
├── Tables/         Table: shape, createTable, patchTable, column list changes, isUniqueKey
├── Relations/      Relation (a foreign key), getCardinality, planManyToMany
└── Diagrams/       the aggregate
    ├── domain/       Diagram, apply (Op), createManyToMany, validate
    └── application/  undo/redo history, example diagram
```

Dependencies go one way: `shared` ← `Columns` ← `Tables` ← `Relations` ← `Diagrams`. Tables, columns and relations only exist inside a diagram, so the editor changes them through `Diagrams` (`apply`), which also keeps relations and the layout consistent.

## API

| Area        | Exports                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| Format      | `Diagram`, `Table`, `Column`, `Relation`, `Layout`, zod schemas, `parseDiagram`          |
| Create      | `createDiagram`, `createTable`, `createColumn`, `createRelation`, `createExampleDiagram` |
| Edit        | `apply`, `applyAll`, `Op`, `createManyToMany`, `OperationError`                          |
| Read        | `getTable`, `getColumn`, `getRelation`, `getCardinality`, `isUniqueKey`, `validate`      |
| Undo / redo | `createHistory`, `push`, `pushOp`, `undo`, `redo`, `canUndo`, `canRedo`, `checkpoint`    |

Each entity module also exports its own pure helpers (`patchTable`, `addColumn`, `usesColumn`, `planManyToMany`…). They work on a single entity and do not keep the diagram consistent; the editor should use `apply`.

Operations (`Op`):

| Type                                                             | Notes                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `table.add` / `table.update` / `table.move` / `table.remove`     | Removing a table also removes its relations and position. |
| `column.add` / `column.update` / `column.move` / `column.remove` | Removing a column also removes the relations that use it. |
| `relation.add` / `relation.update` / `relation.remove`           | Both ends must point at existing tables and columns.      |

In patches, `undefined` on an optional field (`comment`, `default`, `name` of a relation, `color`) removes it.

## Scripts

```sh
bun run test         # bun test
bun run check-types  # tsc --noEmit
```
