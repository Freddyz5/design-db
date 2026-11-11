import { z } from "zod";

/** Current version of the diagram format. Bump it when the shape changes. */
export const DIAGRAM_VERSION = 1;

/** Stable identifier. Names can change; ids never do. */
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

export const DialectSchema = z.enum(["generic", "postgres", "mysql", "sqlite"]);
export type Dialect = z.infer<typeof DialectSchema>;

/** What the database does with the child rows when the parent changes. */
export const RefActionSchema = z.enum([
  "no action",
  "cascade",
  "set null",
  "restrict",
]);
export type RefAction = z.infer<typeof RefActionSchema>;

export const ColumnSchema = z.object({
  id: IdSchema,
  name: z.string(),
  /** Free text, e.g. "varchar(255)" or "int". */
  type: z.string(),
  primaryKey: z.boolean(),
  nullable: z.boolean(),
  unique: z.boolean(),
  autoIncrement: z.boolean(),
  default: z.string().optional(),
  comment: z.string().optional(),
});
export type Column = z.infer<typeof ColumnSchema>;

export const TableSchema = z.object({
  id: IdSchema,
  name: z.string(),
  comment: z.string().optional(),
  /** Order matters: it is the order shown in the editor and in the SQL. */
  columns: z.array(ColumnSchema),
});
export type Table = z.infer<typeof TableSchema>;

export const RelationEndSchema = z.object({
  tableId: IdSchema,
  columnIds: z.array(IdSchema).min(1),
});
export type RelationEnd = z.infer<typeof RelationEndSchema>;

/**
 * A relation is a foreign key: `from` is the child table that holds the
 * foreign key columns, `to` is the parent table they point at.
 */
export const RelationSchema = z.object({
  id: IdSchema,
  name: z.string().optional(),
  from: RelationEndSchema,
  to: RelationEndSchema,
  onDelete: RefActionSchema,
  onUpdate: RefActionSchema,
});
export type Relation = z.infer<typeof RelationSchema>;

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
