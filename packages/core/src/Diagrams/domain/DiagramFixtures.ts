// Helpers for the tests of Diagrams. Not part of the public API.
import { createColumn } from "../../Columns";
import { createRelation } from "../../Relations";
import { createTable } from "../../Tables";
import { createDiagram, type Diagram } from "./Diagram";

/** Freezes an object and everything inside it, so mutations throw. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * users (id PK) <- posts (id PK, user_id FK not null).
 * Ids are fixed so tests can refer to them.
 */
export function blogDiagram(): Diagram {
  const users = createTable({
    id: "users",
    name: "users",
    columns: [
      createColumn({
        id: "users.id",
        name: "id",
        type: "int",
        primaryKey: true,
      }),
      createColumn({ id: "users.email", name: "email", type: "varchar(255)" }),
    ],
  });
  const posts = createTable({
    id: "posts",
    name: "posts",
    columns: [
      createColumn({
        id: "posts.id",
        name: "id",
        type: "int",
        primaryKey: true,
      }),
      createColumn({
        id: "posts.user_id",
        name: "user_id",
        type: "int",
        nullable: false,
      }),
      createColumn({ id: "posts.title", name: "title", type: "text" }),
    ],
  });
  const diagram = createDiagram({ id: "blog", name: "Blog" });
  return {
    ...diagram,
    tables: [users, posts],
    relations: [
      createRelation({
        id: "posts_user",
        from: { tableId: "posts", columnIds: ["posts.user_id"] },
        to: { tableId: "users", columnIds: ["users.id"] },
      }),
    ],
    layout: {
      ...diagram.layout,
      tables: {
        users: { x: 0, y: 0 },
        posts: { x: 300, y: 0, color: "blue" },
      },
    },
  };
}
