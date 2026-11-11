import { z } from "zod";

/** The database a diagram is designed for. `generic` uses standard SQL. */
export const DialectSchema = z.enum(["generic", "postgres", "mysql", "sqlite"]);
export type Dialect = z.infer<typeof DialectSchema>;
