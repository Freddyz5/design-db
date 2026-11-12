import type { Column } from "../../Columns";
import { findEnum, type Diagram } from "../../Diagrams";
import type { Enum } from "../../Enums";
import type { RefAction, Relation } from "../../Relations";
import type { Dialect, Id } from "../../shared";
import type { Table } from "../../Tables";
import {
  ANY_COLUMN,
  builderNames,
  DRIZZLE_MODULE,
  drizzleDialect,
  fromIdentifier,
  JS_RESERVED,
  TABLE_FUNCTION,
  toBuilder,
  toIdentifier,
  type BuilderCall,
  type DrizzleDialect,
  type OptionValue,
} from "./DrizzleSyntax";

/**
 * Generates the Drizzle schema (TypeScript) of a diagram.
 *
 * | | postgres | mysql | sqlite |
 * |---|---|---|---|
 * | tables | pgTable | mysqlTable | sqliteTable |
 * | enums | pgEnum | mysqlEnum + const | text({ enum }) + const |
 * | auto increment | identity | autoincrement() | primaryKey({ autoIncrement }) |
 *
 * `generic` uses PostgreSQL. Comments become `/** … *\/` above the table or
 * column. Types without a builder in the dialect are declared with
 * `customType`, so the SQL type is kept. Groups are not exported (Drizzle
 * has none) and no `relations()` are generated: they belong to the query
 * API, not to the schema. Relations that point at missing tables or
 * columns are skipped.
 */
export function toDrizzle(
  diagram: Diagram,
  dialect: Dialect = diagram.dialect,
): string {
  return new DrizzleWriter(diagram, drizzleDialect(dialect)).write();
}

/** What a column's builder accepts as a default. */
type ColumnKind = {
  builder?: string;
  options: [string, OptionValue][];
  /** A `customType`, whose values are strings. */
  custom?: boolean;
};

class DrizzleWriter {
  private readonly imports = new Set<string>();
  private readonly typeImports = new Set<string>();
  private usesSql = false;

  private readonly taken: Set<string>;
  private readonly tableVars = new Map<Id, string>();
  private readonly columnKeys = new Map<Id, Map<Id, string>>();
  private readonly enumVars = new Map<Id, string>();
  private readonly customTypes = new Map<string, string>();

  constructor(
    private readonly diagram: Diagram,
    private readonly dialect: DrizzleDialect,
  ) {
    this.taken = new Set([
      ...JS_RESERVED,
      ...builderNames(dialect),
      TABLE_FUNCTION[dialect],
      ANY_COLUMN[dialect],
      "pgEnum",
      "mysqlEnum",
      "primaryKey",
      "foreignKey",
      "customType",
      "sql",
      "t",
    ]);
    for (const table of diagram.tables) {
      this.tableVars.set(
        table.id,
        this.unique(toIdentifier(table.name), "Table"),
      );
      const keys = new Map<Id, string>();
      const used = new Set<string>();
      for (const column of table.columns) {
        const base = toIdentifier(column.name);
        let key = base;
        for (let n = 2; used.has(key); n++) key = `${base}${n}`;
        used.add(key);
        keys.set(column.id, key);
      }
      this.columnKeys.set(table.id, keys);
    }
    for (const item of diagram.enums) {
      this.enumVars.set(item.id, this.unique(enumVariable(item.name), "Enum"));
    }
  }

  write(): string {
    const enums = this.diagram.enums.map((e) => this.enumDeclaration(e));
    const tables = this.diagram.tables.map((t, i) => this.table(t, i));
    const customTypes = [...this.customTypes].map(
      ([type, name]) =>
        `const ${name} = customType<{ data: string }>({ dataType: () => ${str(type)} });`,
    );
    const body = [...customTypes, ...enums, ...tables];
    if (!body.length) return "";
    return [...this.importLines(), ...body].join("\n\n") + "\n";
  }

  private importLines(): string[] {
    const lines: string[] = [];
    if (this.usesSql) lines.push(`import { sql } from "drizzle-orm";`);
    const names = [
      ...[...this.imports].map((name) => ({ name, text: name })),
      ...[...this.typeImports].map((name) => ({ name, text: `type ${name}` })),
    ]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => n.text);
    const module = str(DRIZZLE_MODULE[this.dialect]);
    const oneLine = `import { ${names.join(", ")} } from ${module};`;
    lines.push(
      oneLine.length <= 80
        ? oneLine
        : `import {\n${names.map((n) => `  ${n},`).join("\n")}\n} from ${module};`,
    );
    return [lines.join("\n")];
  }

  // --- Enums --------------------------------------------------------------

  private enumDeclaration(item: Enum): string {
    const name = this.enumVars.get(item.id)!;
    const values = `[${item.values.map(str).join(", ")}]`;
    let code: string;
    if (this.dialect === "postgres") {
      this.imports.add("pgEnum");
      code = `export const ${name} = pgEnum(${str(item.name)}, ${values});`;
    } else {
      code = `export const ${name} = ${values} as const;`;
    }
    return doc(item.note, "") + code;
  }

  // --- Tables -------------------------------------------------------------

  private table(table: Table, index: number): string {
    const tableFn = TABLE_FUNCTION[this.dialect];
    this.imports.add(tableFn);

    const primaryKey = table.columns.filter((c) => c.primaryKey);
    const inlineKey = primaryKey.length === 1;

    const inlineRefs = new Map<Id, Relation>();
    const extraRefs: Relation[] = [];
    for (const relation of this.diagram.relations) {
      if (relation.from.tableId !== table.id || !this.resolves(relation)) {
        continue;
      }
      const [columnId] = relation.from.columnIds;
      if (
        relation.from.columnIds.length === 1 &&
        !relation.name &&
        !inlineRefs.has(columnId!)
      ) {
        inlineRefs.set(columnId!, relation);
      } else {
        extraRefs.push(relation);
      }
    }

    const columns = table.columns.map((column) =>
      this.column(table, index, column, inlineKey, inlineRefs.get(column.id)),
    );

    const extras: string[] = [];
    if (primaryKey.length > 1) {
      this.imports.add("primaryKey");
      extras.push(`primaryKey({ columns: [${this.refs(table, primaryKey)}] })`);
    }
    for (const relation of extraRefs) extras.push(this.foreignKey(relation));

    const head = `${doc(table.comment, "")}export const ${this.tableVars.get(table.id)} = ${tableFn}(${str(table.name)}, {`;
    const body = columns.length ? `\n${columns.join("\n")}\n` : "";
    const tail = extras.length
      ? `}, (t) => [\n${extras.map((e) => `  ${e},`).join("\n")}\n]);`
      : "});";
    return head + body + tail;
  }

  private column(
    table: Table,
    tableIndex: number,
    column: Column,
    inlineKey: boolean,
    reference: Relation | undefined,
  ): string {
    const key = this.columnKeys.get(table.id)!.get(column.id)!;
    const nameArg = key === column.name ? undefined : column.name;
    const { call, kind } = this.builder(column, nameArg);

    const chain: string[] = [];
    const isInlineKey = column.primaryKey && inlineKey;
    if (isInlineKey) {
      const sqliteAuto =
        this.dialect === "sqlite" &&
        column.autoIncrement &&
        kind.builder === "integer" &&
        kind.options.length === 0;
      chain.push(
        sqliteAuto ? "primaryKey({ autoIncrement: true })" : "primaryKey()",
      );
    } else if (!column.nullable) {
      chain.push("notNull()");
    }
    if (column.unique && !isInlineKey) chain.push("unique()");
    if (column.default !== undefined && column.default.trim() !== "") {
      chain.push(this.defaultCall(column.default.trim(), kind));
    }
    if (column.autoIncrement) {
      if (this.dialect === "mysql") chain.push("autoincrement()");
      else if (
        this.dialect === "postgres" &&
        !/^(small|big)?serial$/.test(kind.builder ?? "")
      ) {
        chain.push("generatedByDefaultAsIdentity()");
      }
    }
    if (reference) chain.push(this.reference(reference, tableIndex));

    const line = `${key}: ${call}${chain.map((c) => `.${c}`).join("")},`;
    return doc(column.comment, "  ") + `  ${line}`;
  }

  /** The builder call of a column, e.g. `varchar("user_name", { length: 100 })`. */
  private builder(
    column: Column,
    nameArg: string | undefined,
  ): { call: string; kind: ColumnKind } {
    const enumType = findEnum(this.diagram, column.type);
    if (enumType) {
      const values = this.enumVars.get(enumType.id)!;
      switch (this.dialect) {
        case "postgres":
          return {
            call: `${values}(${nameArg ? str(nameArg) : ""})`,
            kind: { options: [] },
          };
        case "mysql":
          this.imports.add("mysqlEnum");
          return {
            call: `mysqlEnum(${str(column.name)}, ${values})`,
            kind: { options: [] },
          };
        case "sqlite":
          this.imports.add("text");
          return {
            call: `text(${nameArg ? `${str(nameArg)}, ` : ""}{ enum: ${values} })`,
            kind: { builder: "text", options: [] },
          };
      }
    }

    const type = column.type.trim() || "text";
    const builder = toBuilder(type, this.dialect);
    if (builder) {
      this.imports.add(builder.builder);
      return {
        call: builderCall(builder, nameArg),
        kind: { builder: builder.builder, options: builder.options },
      };
    }

    let custom = this.customTypes.get(type);
    if (!custom) {
      custom = this.unique(toIdentifier(type.replace(/\(.*$/s, "")), "Type");
      this.customTypes.set(type, custom);
      this.imports.add("customType");
    }
    return {
      call: `${custom}(${str(column.name)})`,
      kind: { options: [], custom: true },
    };
  }

  /**
   * Converts a SQL default: numbers, booleans and strings become values,
   * `now()` and `gen_random_uuid()` their Drizzle methods, and anything
   * else a `sql` expression.
   */
  private defaultCall(value: string, kind: ColumnKind): string {
    const builder = kind.builder ?? "";
    const mode = kind.options.find(([k]) => k === "mode")?.[1];
    const json = builder === "json" || builder === "jsonb" || mode === "json";

    if (/^-?\d+(\.\d+)?$/.test(value) && !kind.custom) {
      if (builder === "numeric" || builder === "decimal") {
        return `default(${str(value)})`;
      }
      if (mode === "boolean" && (value === "0" || value === "1")) {
        return `default(${value === "1"})`;
      }
      return `default(${value})`;
    }
    if (/^(true|false)$/i.test(value) && !kind.custom) {
      return `default(${value.toLowerCase()})`;
    }
    const sqlString = /^'((?:[^']|'')*)'$/.exec(value);
    if (sqlString && !json) {
      return `default(${str(sqlString[1]!.replaceAll("''", "'"))})`;
    }
    if (
      this.dialect === "postgres" &&
      builder === "uuid" &&
      /^gen_random_uuid\(\)$/i.test(value)
    ) {
      return "defaultRandom()";
    }
    if (/^now\(\)$/i.test(value) && this.hasDefaultNow(builder)) {
      return "defaultNow()";
    }
    this.usesSql = true;
    return `default(sql\`${value.replace(/[\\`]|\$\{/g, (m) => `\\${m}`)}\`)`;
  }

  private hasDefaultNow(builder: string): boolean {
    if (this.dialect === "postgres") {
      return ["timestamp", "date", "time"].includes(builder);
    }
    return this.dialect === "mysql" && builder === "timestamp";
  }

  // --- Relations ----------------------------------------------------------

  /** `references(() => users.id, { onDelete: "cascade" })`. */
  private reference(relation: Relation, childIndex: number): string {
    const parentIndex = this.diagram.tables.findIndex(
      (t) => t.id === relation.to.tableId,
    );
    const target = `${this.tableVars.get(relation.to.tableId)}.${this.key(relation.to.tableId, relation.to.columnIds[0]!)}`;
    let arrow = `() => ${target}`;
    if (parentIndex >= childIndex) {
      // A table declared later (or the same one) needs the annotation, or
      // TypeScript cannot infer the type of the table.
      this.typeImports.add(ANY_COLUMN[this.dialect]);
      arrow = `(): ${ANY_COLUMN[this.dialect]} => ${target}`;
    }
    const actions = [
      ...action("onDelete", relation.onDelete),
      ...action("onUpdate", relation.onUpdate),
    ];
    return `references(${arrow}${actions.length ? `, { ${actions.join(", ")} }` : ""})`;
  }

  /** `foreignKey({ columns, foreignColumns }).onDelete("cascade")`. */
  private foreignKey(relation: Relation): string {
    this.imports.add("foreignKey");
    const child = this.tableById(relation.from.tableId)!;
    const parent = this.tableById(relation.to.tableId)!;
    const self = child.id === parent.id;
    const fields = [
      ...(relation.name ? [`name: ${str(relation.name)}`] : []),
      `columns: [${this.refs(child, columnsOf(child, relation.from.columnIds)!)}]`,
      `foreignColumns: [${this.refs(parent, columnsOf(parent, relation.to.columnIds)!, self ? "t" : this.tableVars.get(parent.id)!)}]`,
    ];
    let code = `foreignKey({ ${fields.join(", ")} })`;
    if (relation.onDelete !== "no action") {
      code += `.onDelete(${str(relation.onDelete)})`;
    }
    if (relation.onUpdate !== "no action") {
      code += `.onUpdate(${str(relation.onUpdate)})`;
    }
    return code;
  }

  /** `t.a, t.b` (own table) or `users.id` (another table). */
  private refs(table: Table, columns: Column[], owner = "t"): string {
    return columns
      .map((c) => `${owner}.${this.key(table.id, c.id)}`)
      .join(", ");
  }

  private resolves(relation: Relation): boolean {
    const child = this.tableById(relation.from.tableId);
    const parent = this.tableById(relation.to.tableId);
    return Boolean(
      child &&
      parent &&
      relation.from.columnIds.length > 0 &&
      columnsOf(child, relation.from.columnIds) &&
      columnsOf(parent, relation.to.columnIds),
    );
  }

  // --- Helpers ------------------------------------------------------------

  private tableById(tableId: Id): Table | undefined {
    return this.diagram.tables.find((t) => t.id === tableId);
  }

  private key(tableId: Id, columnId: Id): string {
    return this.columnKeys.get(tableId)!.get(columnId)!;
  }

  /** A free variable name: `base`, else `base` + suffix (+ a number). */
  private unique(base: string, suffix: string): string {
    let name = base;
    if (this.taken.has(name)) name = `${base}${suffix}`;
    for (let n = 2; this.taken.has(name); n++) name = `${base}${suffix}${n}`;
    this.taken.add(name);
    return name;
  }
}

/**
 * The variable of an enum. MySQL and SQLite enums are plain arrays, so the
 * name must come back from the variable: `post_status` ↔ `postStatus`.
 */
function enumVariable(name: string): string {
  const camel = toIdentifier(name);
  if (fromIdentifier(camel) === name) return camel;
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : camel;
}

function builderCall(
  builder: BuilderCall,
  nameArg: string | undefined,
): string {
  const args: string[] = [];
  if (nameArg !== undefined) args.push(str(nameArg));
  if (builder.options.length) {
    const fields = builder.options.map(
      ([key, value]) =>
        `${key}: ${typeof value === "string" ? str(value) : String(value)}`,
    );
    args.push(`{ ${fields.join(", ")} }`);
  }
  return `${builder.builder}(${args.join(", ")})${builder.array ? ".array()" : ""}`;
}

function columnsOf(table: Table, ids: Id[]): Column[] | undefined {
  const columns = ids.map((id) => table.columns.find((c) => c.id === id));
  return columns.every((c) => c !== undefined)
    ? (columns as Column[])
    : undefined;
}

function action(key: string, value: RefAction): string[] {
  return value === "no action" ? [] : [`${key}: ${str(value)}`];
}

/** A `/** … *\/` comment line (or block) with the given indent. */
function doc(text: string | undefined, indent: string): string {
  if (!text?.trim()) return "";
  const lines = text
    .trim()
    .replaceAll("*/", "*\\/")
    .split(/\r?\n/)
    .map((l) => l.trimEnd());
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
  return (
    `${indent}/**\n` +
    lines.map((l) => `${indent} *${l ? ` ${l}` : ""}`).join("\n") +
    `\n${indent} */\n`
  );
}

/** A JavaScript string literal. */
function str(value: string): string {
  return JSON.stringify(value);
}
