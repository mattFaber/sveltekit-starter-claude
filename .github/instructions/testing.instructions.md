---
description: "Use when writing, running, or reviewing tests — unit tests with Vitest, component tests, or Playwright e2e tests. Covers test structure, naming, coverage expectations, and anti-patterns."
applyTo: ["src/**/*.test.ts", "tests/**"]
---

# Testing Standards

## Unit Tests (Vitest — `src/**/*.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { myUtil } from './my-util';

describe('myUtil', () => {
  it('returns expected value for valid input', () => {
    expect(myUtil('input')).toBe('expected');
  });

  it('throws for invalid input', () => {
    expect(() => myUtil('')).toThrow('Input cannot be empty');
  });
});
```

- Co-locate test next to source: `src/lib/utils/format.ts` → `src/lib/utils/format.test.ts`
- Every exported utility function requires at least one test
- Cover happy path and one error/edge case per function

## Component Tests (Vitest + Testing Library)

```typescript
import { render, screen } from '@testing-library/svelte';
import MyComponent from './MyComponent.svelte';

it('renders label', () => {
  render(MyComponent, { props: { label: 'Hello' } });
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## E2E Tests (Playwright — `tests/**`)

```typescript
import { test, expect } from '@playwright/test';

test('user can submit form', async ({ page }) => {
  await page.goto('/form');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

- E2e tests cover **critical user flows** only (auth, checkout, core CRUD)
- Use `page.getByRole()` and `page.getByLabel()` over CSS selectors
- Never use `page.waitForTimeout()` — use `expect(...).toBeVisible()` or explicit waits

## Hard Rules

- No `test.only` or `it.only` committed to main
- No mocking of the module under test itself
- Tests must be deterministic — no random data, no real network calls (mock fetch)
- Run `npm run test:unit` before committing utility changes

## Response Size

- Write tests for one module per response
- Do not generate test files for code that doesn't exist yet in the same response
