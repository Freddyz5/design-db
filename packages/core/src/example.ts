import {
  createColumn,
  createDiagram,
  createRelation,
  createTable,
} from "./factories";
import { createManyToMany } from "./many-to-many";
import { applyAll } from "./operations";
import type { Diagram } from "./schema";

/**
 * A small blog: users, posts, comments and tags (posts <-> tags is N:M).
 * Useful for tests, demos and as the editor's starting point.
 */
export function createExampleDiagram(): Diagram {
  const id = (name: string) =>
    createColumn({ name, type: "int", primaryKey: true, autoIncrement: true });
  const foreignKey = (name: string, nullable = false) =>
    createColumn({ name, type: "int", nullable });

  const users = createTable({
    name: "users",
    columns: [
      id("id"),
      createColumn({
        name: "email",
        type: "varchar(255)",
        unique: true,
        nullable: false,
      }),
      createColumn({ name: "name", type: "varchar(100)" }),
      createColumn({
        name: "created_at",
        type: "timestamp",
        nullable: false,
        default: "now()",
      }),
    ],
  });
  const posts = createTable({
    name: "posts",
    columns: [
      id("id"),
      foreignKey("author_id"),
      createColumn({ name: "title", type: "varchar(200)", nullable: false }),
      createColumn({ name: "body", type: "text" }),
      createColumn({ name: "published_at", type: "timestamp" }),
    ],
  });
  const comments = createTable({
    name: "comments",
    columns: [
      id("id"),
      foreignKey("post_id"),
      foreignKey("author_id", true),
      createColumn({ name: "body", type: "text", nullable: false }),
    ],
  });
  const tags = createTable({
    name: "tags",
    columns: [
      id("id"),
      createColumn({
        name: "name",
        type: "varchar(50)",
        unique: true,
        nullable: false,
      }),
    ],
  });

  const column = (table: typeof users, name: string) =>
    table.columns.find((c) => c.name === name)!.id;
  const references = (
    child: typeof users,
    fk: string,
    parent: typeof users,
    onDelete: "cascade" | "set null",
  ) => ({
    type: "relation.add" as const,
    relation: createRelation({
      from: { tableId: child.id, columnIds: [column(child, fk)] },
      to: { tableId: parent.id, columnIds: [column(parent, "id")] },
      onDelete,
    }),
  });

  const diagram = applyAll(createDiagram({ name: "Blog" }), [
    { type: "table.add", table: users, position: { x: 0, y: 0 } },
    { type: "table.add", table: posts, position: { x: 360, y: 0 } },
    { type: "table.add", table: comments, position: { x: 180, y: 280 } },
    { type: "table.add", table: tags, position: { x: 720, y: 0 } },
    references(posts, "author_id", users, "cascade"),
    references(comments, "post_id", posts, "cascade"),
    references(comments, "author_id", users, "set null"),
  ]);

  return createManyToMany(diagram, posts.id, tags.id).diagram;
}
