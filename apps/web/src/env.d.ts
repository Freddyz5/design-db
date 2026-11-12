// `tsc` cannot read .astro files (and `astro check` does not support
// TypeScript 7 yet). This lets a module's index.ts re-export its Astro components.
declare module "*.astro" {
  const Component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default Component;
}
