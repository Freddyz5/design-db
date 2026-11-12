<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## Repository structure

This repo follows the repo-blueprints preset `ts-hexagonal`, recorded in `.blueprint.json`. Before adding a module, folder or file, decide where it goes from those rules (with the `repo-blueprints` skill in Expand mode, when available) instead of improvising a layout.

`packages/core` uses the `core` variant:

- One folder per concept: `Diagrams`, `Tables`, `Columns`, `Relations`, `Groups`, `Enums`, plus `shared` and `Formats`.
- Each module exposes its public API in `index.ts`. Other modules import only from that file, never from its internals.
- Dependencies go one way: `shared` ← `Columns` ← `Tables` ← `Relations` ← `Diagrams` ← `Formats`. `Groups` and `Enums` depend only on `shared`. Never import against this direction.
- `shared` only holds what two or more modules use.
- Tests live next to the code they test: `<File>.test.ts`.
- `Diagrams` is the aggregate: the editor changes tables, columns and relations through `apply`, which keeps relations and layout consistent. The entity modules only change one entity at a time.

Intentional differences from the blueprint:

- No `DiagramRepository` port or `infrastructure/` folder until persistence is added (SQLite, phase 3).
- A single `Id` in `shared` instead of one per entity, since all ids are the same kind.
- `Tables`, `Columns`, `Relations`, `Groups` and `Enums` have no `application/` folder: they have no actions of their own.
- `Formats` (SQL, DBML and Drizzle export and import) is not a business concept; it is a module by decision of the project, so formats stay out of `Diagrams`.

`apps/web` uses the `web-astro` variant. All front-end code lives here; there is no separate editor package.

- `src/pages/` holds thin routes: `/` composes `Landing`, `/app` mounts `Editor` as a client-only React island.
- `src/modules/Landing` and `src/modules/Editor`: each exposes its public API in `index.ts`, with its components in `components/`. Pages import only from that file.
- `Editor` is a single module. Its zones (canvas, table panel, code panel…) share one store, so they are subfolders of `components/`, not sibling modules.
- The site's text lives in `src/content/site.json`.

Intentional differences from the blueprint in `apps/web`:

- `src/layouts/` (base layout) and `src/styles/` (global CSS and theme) follow the Astro convention instead of living in `src/modules/shared/`.
