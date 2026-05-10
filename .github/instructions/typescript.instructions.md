---
description: "Use when writing TypeScript files, utility functions, type definitions, or stores in this repo. Covers TypeScript strictness, type patterns, no-any rule, and lib structure."
applyTo: "src/**/*.ts"
---

# TypeScript Standards

## Type Rules

- **No `any`** — use `unknown` and narrow with type guards, or define proper interfaces
- **No type assertions (`as`)** without a narrowing check immediately before
- All function parameters and return types must be explicit (avoid implicit `any` from inference gaps)
- Use `interface` for object shapes that may be extended; `type` for unions, intersections, primitives

## Utility Functions (`src/lib/utils/`)

- Pure functions only — no Svelte imports, no side effects
- Every exported function must have a co-located `*.test.ts` with at least one unit test
- Use overloads for functions with multiple call signatures rather than union parameters

## Stores (`src/lib/stores/`)

- Only use stores for **global** state shared across route boundaries
- Prefer Svelte 5 runes (`$state` in a `.svelte.ts` file) for shared reactive state
- Store files must export the store and any derived stores; do not export store internals

```typescript
// src/lib/stores/user.svelte.ts — preferred for Svelte 5
export const user = $state<User | null>(null);

// src/lib/stores/counter.ts — classic writable (still valid for non-component state)
import { writable } from 'svelte/store';
export const count = writable(0);
```

## Environment Variables

- Private/server secrets: `$env/static/private` or `$env/dynamic/private` — import only in `*.server.ts` files
- Public config: `$env/static/public` or `$env/dynamic/public`
- Never pass private env vars to client-visible modules

## Response Size

- Return one module/file per response
- For large refactors, make changes function by function, not entire file rewrites
