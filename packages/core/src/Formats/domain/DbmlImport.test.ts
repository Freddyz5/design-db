import { describe, expect, test } from "bun:test";
import { readDbml } from "./DbmlImport";
import { buildDiagram } from "./SchemaDraft";

function read(text: string) {
  const result = readDbml(text);
  if (!result.draft) throw new Error(JSON.stringify(result.errors));
  return buildDiagram(result.draft);
}

const table = (doc: ReturnType<typeof read>["diagram"], name: string) =>
  doc.tables.find((t) => t.name === name)!;

describe("readDbml", () => {
  test("project, enums, tables, refs and groups", () => {
    const { diagram, warnings } = read(`
      Project shop {
        database_type: 'PostgreSQL'
        Note: 'Online shop'
      }

      // statuses
      Enum order_status {
        open
        "in progress" [note: 'Being prepared']
      }

      Table users as U [headercolor: #3498DB] {
        id integer [pk, increment]
        email varchar(255) [unique, not null, note: 'Login']
        created_at timestamp [default: \`now()\`]
        Note: 'Customers'
      }

      Table orders {
        id int [primary key]
        user_id int [not null, ref: > users.id]
        status order_status [default: 'open']
        total "decimal(10,2)" [default: -1]
      }

      Ref fk_orders: orders.user_id > users.id [delete: cascade, update: no action]

      TableGroup sales [color: #2c5f8e] {
        orders
        Note: '''
          Everything
          about sales
        '''
      }
    `);

    expect(warnings).toEqual([]);
    expect(diagram.name).toBe("shop");
    expect(diagram.dialect).toBe("postgres");
    expect(diagram.enums[0]).toMatchObject({
      name: "order_status",
      values: ["open", "in progress"],
    });

    const users = table(diagram, "users");
    expect(users.comment).toBe("Customers");
    expect(users.columns[0]).toMatchObject({
      primaryKey: true,
      autoIncrement: true,
    });
    expect(users.columns[1]).toMatchObject({
      type: "varchar(255)",
      unique: true,
      nullable: false,
      comment: "Login",
    });
    expect(users.columns[2]!.default).toBe("now()");

    const orders = table(diagram, "orders");
    expect(orders.columns[2]!.default).toBe("'open'");
    expect(orders.columns[3]).toMatchObject({
      type: "decimal(10,2)",
      default: "-1",
    });

    expect(diagram.relations.map((r) => [r.name, r.onDelete])).toEqual([
      [undefined, "no action"],
      ["fk_orders", "cascade"],
    ]);

    expect(diagram.groups[0]).toMatchObject({
      name: "sales",
      color: "#2c5f8e",
      note: "Everything\nabout sales",
    });
    expect(orders.groupId).toBe(diagram.groups[0]!.id);
    expect(users.groupId).toBeUndefined();
  });

  test("ref directions, one-to-one, composite and long form", () => {
    const { diagram } = read(`
      Table a { id int [pk] }
      Table b { id int [pk]
        a_id int
        x int
        y int }
      Table c { x int
        y int
        indexes { (x, y) [pk] } }
      Ref: a.id < b.a_id
      Ref { b.id - a.id }
      Ref: b.(x, y) > c.(x, y)
    `);
    const [a, b, c] = ["a", "b", "c"].map((n) => table(diagram, n));
    expect(
      diagram.relations.map((r) => [r.from.tableId, r.to.tableId]),
    ).toEqual([
      [b!.id, a!.id],
      [b!.id, a!.id],
      [b!.id, c!.id],
    ]);
    expect(b!.columns[0]!.primaryKey).toBe(true);
    expect(c!.columns.every((col) => col.primaryKey)).toBe(true);
    expect(diagram.relations[2]!.from.columnIds).toHaveLength(2);
  });

  test("one-to-one makes the foreign key unique", () => {
    const { diagram } = read(`
      Table users { id int [pk] }
      Table profiles { id int [pk]
        user_id int }
      Ref: profiles.user_id - users.id
    `);
    expect(table(diagram, "profiles").columns[1]!.unique).toBe(true);
  });

  test("many-to-many creates the join table", () => {
    const { diagram } = read(`
      Table posts { id int [pk] }
      Table tags { id int [pk] }
      Ref: posts.id <> tags.id
    `);
    expect(diagram.tables.map((t) => t.name)).toEqual([
      "posts",
      "tags",
      "posts_tags",
    ]);
    expect(diagram.relations).toHaveLength(2);
  });

  test("skips sticky notes and warns about unknown group tables", () => {
    const { diagram, warnings } = read(`
      Note intro { 'Hello' }
      Table t { id int }
      TableGroup g { t
        ghost }
    `);
    expect(diagram.tables).toHaveLength(1);
    expect(warnings[0]!.message).toContain('"ghost"');
  });

  test("reports errors with their line", () => {
    expect(readDbml("Table t {\n  id int\n").errors).toEqual([
      { message: "Missing } at the end of the table", line: 1 },
    ]);
    expect(readDbml("Table t {\n  id int [pk\n}").errors[0]!.line).toBe(3);
    expect(readDbml("Tabel t {}").errors[0]).toEqual({
      message: 'Unexpected "Tabel"',
      line: 1,
    });
    expect(readDbml("Table t { note 'x }").errors[0]!.message).toBe(
      "Unclosed string",
    );
  });
});
