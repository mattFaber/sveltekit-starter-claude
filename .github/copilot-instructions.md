# SvelteKit Starter — Project Guidelines

## Stack

- **Framework**: SvelteKit 2 with Svelte 5
- **Language**: TypeScript (strict)
- **Testing**: Vitest (unit + component), Playwright (e2e)
- **Formatting**: Prettier, ESLint

## Build & Dev Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run preview      # preview production build
npm run check        # svelte-check + tsc
npm run lint         # eslint + prettier check
npm run format       # prettier write
npm run test:unit    # vitest
npm run test:e2e     # playwright
```

## Architecture Conventions

- **Routing**: file-based under `src/routes/`; use `+page.svelte`, `+layout.svelte`, `+server.ts`, `+page.server.ts`
- **Components**: `src/lib/components/` — one component per file, PascalCase filenames
- **Utilities**: `src/lib/utils/` — pure functions, no Svelte imports
- **Types**: `src/lib/types/` — shared TypeScript interfaces and types
- **Stores**: `src/lib/stores/` — only for truly global state; prefer runes for component-local state
- **Import alias**: use `$lib/` for `src/lib/`

## Code Standards

- Use **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`) — never Svelte 4 Options API
- All `load` functions must be typed with `PageData` / `LayoutData`
- No `any` types — use `unknown` and narrow
- Components must be self-contained; avoid prop-drilling more than 2 levels (use stores or context)
- Server-only secrets go in `$env/static/private` or `$env/dynamic/private` — never in client code

## Testing Requirements

- Unit tests live next to the source file as `*.test.ts`
- Every utility function must have a unit test
- E2e tests live in `tests/` and cover critical user flows

## Response Size Guardrail

When working with AI tools in this repo: implement changes file by file. Do not generate entire large files in a single response — prefer incremental edits.

See `.github/instructions/` for detailed per-domain guardrails.
