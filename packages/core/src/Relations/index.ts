// Public API of Relations.
export {
  RefActionSchema,
  RelationEndSchema,
  RelationSchema,
  createRelation,
  patchRelation,
  usesColumn,
  usesTable,
} from "./domain/Relation";
export type {
  RefAction,
  Relation,
  RelationEnd,
  RelationPatch,
} from "./domain/Relation";
export { getCardinality } from "./domain/RelationCardinality";
export type { Cardinality } from "./domain/RelationCardinality";
export { planManyToMany } from "./domain/RelationManyToMany";
export type { ManyToManyPlan } from "./domain/RelationManyToMany";
