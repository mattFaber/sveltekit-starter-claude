---
description: "Use when adding security-sensitive code: authentication, authorization, API endpoints, form handling, environment variables, user input processing, cookies, or CSRF. Covers OWASP Top 10 guardrails for SvelteKit."
---

# Security Guardrails (SvelteKit)

## Input Validation

- Validate and sanitize **all** user input server-side before use — never trust client data
- Use a schema validation library (e.g. Zod) for form actions and API endpoints:

```typescript
import { z } from 'zod';

const schema = z.object({ email: z.string().email(), name: z.string().min(1).max(100) });

export const actions: Actions = {
  default: async ({ request }) => {
    const raw = Object.fromEntries(await request.formData());
    const result = schema.safeParse(raw);
    if (!result.success) return fail(400, { errors: result.error.flatten() });
    // safe to use result.data
  }
};
```

## Authentication & Authorization

- Check `locals.user` at the start of every protected `load` function and action
- Redirect unauthenticated users in `hooks.server.ts` `handle()` — not on the client
- Never store session tokens in `localStorage` — use `HttpOnly` cookies

## Environment Variables

- `$env/static/private` / `$env/dynamic/private`: server-only, never referenced in client code
- Never commit `.env` files with real secrets — only `.env.example`

## API Endpoints (+server.ts)

- Return `error(401)` before any data access when auth fails
- Return `error(403)` for authenticated-but-unauthorized requests
- Do not expose internal error messages or stack traces — log server-side, return generic message

## SQL / Database

- Never interpolate user input into queries — use parameterized queries or ORM
- Drizzle ORM and Prisma are both safe by default — avoid raw query escape hatches unless necessary

## Headers & CSP

- Set security headers in `hooks.server.ts`:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
};
```

## Hard Rules

- DO NOT `eval()` or `new Function()` with user-provided content
- DO NOT use `dangerouslySetInnerHTML` equivalents (Svelte's `{@html}`) with unsanitized user input
- DO NOT disable CSRF protection in SvelteKit form actions (it's on by default — don't opt out)
- DO NOT log passwords, tokens, or PII — even in development

## Response Size

- Security code must be complete and correct in a single response — do not stub validation
