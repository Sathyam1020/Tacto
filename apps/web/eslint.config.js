import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  // Static assets served verbatim (e.g. the framework-agnostic embed.js SDK) are
  // not part of the TypeScript/React source and shouldn't be linted as such.
  { ignores: ["public/**"] },
  ...nextJsConfig,
]
