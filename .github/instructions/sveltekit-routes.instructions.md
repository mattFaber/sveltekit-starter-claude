---
description: "Use when writing SvelteKit route files: +page.svelte, +page.ts, +page.server.ts, +layout.svelte, +layout.ts, +layout.server.ts, +server.ts, +error.svelte. Covers load functions, form actions, server endpoints, hooks, and data typing."
applyTo: "src/routes/**"
---

# SvelteKit Route Standards

## Load Functions

```typescript
// +page.ts (universal — runs on server + client)
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
  const res = await fetch(`/api/items/${params.id}`);
  if (!res.ok) throw error(404, 'Not found');
  return { item: await res.json() };
};

// +page.server.ts (server-only — can access DB, secrets)
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  // locals set by hooks, direct DB access OK here
  return { user: locals.user };
};
```

## Form Actions

```typescript
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const name = data.get('name');
    if (!name) return fail(400, { error: 'Name is required' });
    // ... save
    redirect(303, '/success');
  }
};
```

## Server Endpoints (+server.ts)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  // Validate auth before returning data
  if (!locals.user) throw error(401, 'Unauthorized');
  return json({ data: [] });
};
```

## Hard Rules

- Always use `$types` imports for type safety (`PageLoad`, `PageServerLoad`, `Actions`, `RequestHandler`)
- Use SvelteKit `fetch` (provided in `load` context) — **not** global `fetch` — for SSR compatibility
- Never import server-side code (DB clients, `$env/static/private`) in `+page.ts` or `+layout.ts`
- Use `error()` from `@sveltejs/kit` for HTTP errors — never `throw new Error()`
- Use `redirect()` from `@sveltejs/kit` after mutations — always `303` for POST→redirect
- Validate and sanitize all user input in server actions/endpoints before use
- Never expose raw DB errors or stack traces to clients

## Page Options

```typescript
// Only set when deviating from defaults
export const prerender = true;   // static generation
export const ssr = false;        // SPA mode (rare)
export const csr = false;        // no JS hydration (rare)
```

## Response Size

- One route file at a time in each response
- Load function + actions in the same file is fine; keep each function <40 lines
