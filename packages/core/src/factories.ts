import {
  DIAGRAM_VERSION,
  type Column,
  type Diagram,
  type Dialect,
  type Id,
  type Relation,
  type Table,
} from "./schema";

export function createId(): Id {
  return crypto.randomUUID();
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

export function createTable(init: Partial<Table> = {}): Table {
  const table: Table = {
    id: init.id ?? createId(),
    name: init.name ?? "table",
    columns: init.columns ?? [],
  };
  if (init.comment !== undefined) table.comment = init.comment;
  return table;
}

/** Columns are nullable by default, except primary keys. */
export function createColumn(init: Partial<Column> = {}): Column {
  const primaryKey = init.primaryKey ?? false;
  const column: Column = {
    id: init.id ?? createId(),
    name: init.name ?? "column",
    type: init.type ?? "text",
    primaryKey,
    nullable: init.nullable ?? !primaryKey,
    unique: init.unique ?? false,
    autoIncrement: init.autoIncrement ?? false,
  };
  if (init.default !== undefined) column.default = init.default;
  if (init.comment !== undefined) column.comment = init.comment;
  return column;
}

export function createRelation(
  init: Pick<Relation, "from" | "to"> & Partial<Relation>,
): Relation {
  const relation: Relation = {
    id: init.id ?? createId(),
    from: init.from,
    to: init.to,
    onDelete: init.onDelete ?? "no action",
    onUpdate: init.onUpdate ?? "no action",
  };
  if (init.name !== undefined) relation.name = init.name;
  return relation;
}
