// Types for static image imports — `import hero from "../../images/hero.webp"`.
//
// Next ships these declarations in next/image-types/global, but they normally
// reach TypeScript only through next-env.d.ts, which is gitignored and written
// by `next build`. CI runs `tsc --noEmit` BEFORE `npm run build`, so on a clean
// checkout that file has never existed and every image import fails with
// TS2307 — while passing locally, where an earlier build already generated it.
//
// Referencing the declarations here makes typecheck independent of build order
// and identical locally and in CI.
/// <reference types="next/image-types/global" />
