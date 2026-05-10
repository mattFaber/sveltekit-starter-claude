---
description: "Use when writing, editing, or reviewing Svelte components or .svelte files. Enforces Svelte 5 runes syntax, component structure, prop patterns, reactivity rules, and accessibility requirements."
applyTo: "**/*.svelte"
---

# Svelte Component Standards

## Runes — Required Patterns

```svelte
<script lang="ts">
  // Props — always use $props(), destructure with types
  let { label, count = 0, onclick }: { label: string; count?: number; onclick?: () => void } = $props();

  // Local state
  let value = $state('');

  // Derived values — no side effects allowed inside
  let doubled = $derived(count * 2);

  // Complex derivations
  let processed = $derived.by(() => {
    return value.trim().toLowerCase();
  });

  // Side effects — cleanup optional but preferred
  $effect(() => {
    const id = setInterval(() => {}, 1000);
    return () => clearInterval(id);
  });
</script>
```

## Hard Rules

- **No Svelte 4**: Never use `export let`, `$:`, `<script context="module">`, `createEventDispatcher`
- **No `any`**: Use `unknown` and narrow, or proper interfaces
- **No prop mutation**: If two-way binding is required, use `$bindable()`
- **No bare `onclick`** as string attributes — use event handler syntax `{onclick}`
- **Slots → Snippets**: Use `{#snippet}` and `{@render}` — not `<slot>` — for Svelte 5 projects
- **`$effect` must not return values** other than a cleanup function

## Component File Structure

```
<script lang="ts">
  // 1. imports
  // 2. $props()
  // 3. $state / $derived / $effect
  // 4. functions
</script>

<!-- markup -->

<style>
  /* scoped styles — only if Tailwind isn't sufficient */
</style>
```

## Accessibility

- All interactive elements need accessible labels (`aria-label`, `aria-labelledby`, or visible text)
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<header>`) not `<div onclick>`
- Images need `alt` attributes (empty string for decorative images)

## Response Size

- Return one component per response
- For components >80 lines, split logic into sub-components or utility functions
