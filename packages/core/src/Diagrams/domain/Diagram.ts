import { z } from "zod";
import { RelationSchema, type Relation } from "../../Relations";
import { createId, IdSchema, OperationError, type Id } from "../../shared";
import { TableSchema, type Table } from "../../Tables";

/** Current version of the diagram format. Bump it when the shape changes. */
export const DIAGRAM_VERSION = 1;

export const DialectSchema = z.enum(["generic", "postgres", "mysql", "sqlite"]);
export type Dialect = z.infer<typeof DialectSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const TableLayoutSchema = PositionSchema.extend({
  color: z.string().optional(),
});
export type TableLayout = z.infer<typeof TableLayoutSchema>;

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

/** Everything visual lives here, apart from the schema. */
export const LayoutSchema = z.object({
  tables: z.record(IdSchema, TableLayoutSchema),
  viewport: ViewportSchema,
});
export type Layout = z.infer<typeof LayoutSchema>;

/** The aggregate: tables, columns and relations only exist inside a diagram. */
export const DiagramSchema = z.object({
  version: z.literal(DIAGRAM_VERSION),
  id: IdSchema,
  name: z.string(),
  dialect: DialectSchema,
  tables: z.array(TableSchema),
  relations: z.array(RelationSchema),
  layout: LayoutSchema,
});
export type Diagram = z.infer<typeof DiagramSchema>;

export type ParseResult =
  { ok: true; diagram: Diagram } | { ok: false; error: string };

/**
 * Checks that an already-parsed JSON value is a valid diagram.
 * It only checks the shape; use `validate` for semantic problems.
 */
export function parseDiagram(input: unknown): ParseResult {
  const result = DiagramSchema.safeParse(input);
  if (result.success) return { ok: true, diagram: result.data };
  return { ok: false, error: z.prettifyError(result.error) };
}

export function createDiagram(
  init: { id?: Id; name?: string; dialect?: Dialect } = {},
): Diagram {
  return {
    version: DIAGRAM_VERSION,
    id: init.id ?? createId(),
    name: init.name ?? "Untitled diagram",
    dialect: init.dialect ?? "generic",
    tables: [],
    relations: [],
    layout: { tables: {}, viewport: { x: 0, y: 0, zoom: 1 } },
  };
}

export function getTable(diagram: Diagram, tableId: Id): Table {
  const table = diagram.tables.find((t) => t.id === tableId);
  if (!table) throw new OperationError(`Table ${tableId} not found`);
  return table;
}

export function getRelation(diagram: Diagram, relationId: Id): Relation {
  const relation = diagram.relations.find((r) => r.id === relationId);
  if (!relation) throw new OperationError(`Relation ${relationId} not found`);
  return relation;
}
