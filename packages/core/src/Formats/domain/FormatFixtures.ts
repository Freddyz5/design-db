// Sample diagram for the tests of Formats. Not part of the public API.
import { createColumn } from "../../Columns";
import { applyAll, createDiagram, type Diagram } from "../../Diagrams";
import { createEnum } from "../../Enums";
import { createGroup } from "../../Groups";
import { createRelation } from "../../Relations";
import { createTable } from "../../Tables";

/**
 * users (id, email) <- posts (id, user_id, status, "order", title), with a
 * post_status enum, comments, a reserved word and a group.
 */
export function sampleDiagram(): Diagram {
  const users = createTable({
    id: "users",
    name: "users",
    comment: "People who write",
    groupId: "accounts",
    columns: [
      createColumn({
        id: "users.id",
        name: "id",
        type: "integer",
        primaryKey: true,
        autoIncrement: true,
      }),
      createColumn({
        id: "users.email",
        name: "email",
        type: "varchar(255)",
        nullable: false,
        unique: true,
      }),
    ],
  });
  const posts = createTable({
    id: "posts",
    name: "posts",
    columns: [
      createColumn({
        id: "posts.id",
        name: "id",
        type: "integer",
        primaryKey: true,
        autoIncrement: true,
      }),
      createColumn({
        id: "posts.user_id",
        name: "user_id",
        type: "integer",
        nullable: false,
      }),
      createColumn({
        id: "posts.status",
        name: "status",
        type: "post_status",
        nullable: false,
        default: "'draft'",
      }),
      createColumn({ id: "posts.order", name: "order", type: "integer" }),
      createColumn({
        id: "posts.title",
        name: "title",
        type: "text",
        comment: "Shown in lists",
      }),
    ],
  });
  return applyAll(createDiagram({ name: "Blog", dialect: "postgres" }), [
    {
      type: "group.add",
      group: createGroup({
        id: "accounts",
        name: "accounts",
        color: "#2c5f8e",
      }),
    },
    {
      type: "enum.add",
      enum: createEnum({ name: "post_status", values: ["draft", "published"] }),
    },
    { type: "table.add", table: users },
    { type: "table.add", table: posts },
    {
      type: "relation.add",
      relation: createRelation({
        id: "posts_user",
        from: { tableId: "posts", columnIds: ["posts.user_id"] },
        to: { tableId: "users", columnIds: ["users.id"] },
        onDelete: "cascade",
      }),
    },
  ]);
}
