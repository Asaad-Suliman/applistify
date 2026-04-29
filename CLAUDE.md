# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

TypeScript check: `npx tsc --noEmit`

There are no tests yet. The test suite will live in `/tests` when added.

## Next.js 16 Breaking Changes

**This is Next.js 16 — not 15.** Before writing any Next.js code, read `node_modules/next/dist/docs/` for current API specifics. Key breaking changes already in effect:

- **Middleware is now `proxy.ts`** at the project root. The exports must be named `proxy` (not `middleware`) and `proxyConfig` (not `config`). Using `middleware.ts` silently fails.
- **`next.config.ts` must use `process.cwd()`**, not `__dirname` — ESM loading makes `__dirname` undefined.

## Architecture

### Request Flow

```
Request → proxy.ts (session refresh + route guard)
              ↓
        app/page.tsx (Server Component — redirects based on auth)
              ↓
        /login or /optimize
```

`proxy.ts` runs on every non-static request. It refreshes the Supabase session cookie and enforces auth on `/optimize` and `/history`. Any new protected routes must be added to the `isProtected` check in `proxy.ts`.

### Supabase Client Pattern

Two separate clients — never swap them:

- `lib/supabase/client.ts` — browser only (`createBrowserClient`). Use inside `'use client'` components.
- `lib/supabase/server.ts` — server only (`createServerClient` + `cookies()`). Use in Server Components, Server Actions, and Route Handlers.

### Route Structure

- `app/page.tsx` — auth gate only; redirects to `/optimize` or `/login`
- `app/(auth)/login` and `app/(auth)/signup` — public auth pages
- `/optimize` and `/history` — protected; not yet built (Day 2+)
- `components/auth/` — client components (`'use client'`) for login and signup forms

### Path Alias

`@/*` resolves to the project root. Use it for all internal imports.

## Known Infrastructure Quirks

- **Turbopack root**: `next.config.ts` sets `turbopack: { root: process.cwd() }`. This is required because there is a stray `package.json` at `/home/asaad/` that confuses Turbopack's workspace root detection if omitted.
- **`suppressHydrationWarning` on `<html>`**: Intentional. The Dark Reader browser extension injects `data-darkreader-*` attributes causing false SSR/client mismatches. Do not remove it.
- **Tailwind v4 syntax**: `app/globals.css` uses `@import "tailwindcss"` — not the v3 `@tailwind` directives. Do not revert to v3 syntax.

## Supabase

The Supabase project has a live database schema and a `handle_new_user` trigger. **Do not modify the DB schema directly** — all schema changes must go through Supabase migrations.

Environment variables required in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Known Mistakes

- **`process.cwd()` in `next.config.ts` is unreliable** — it depends on the directory `npm run dev` is invoked from and gives the wrong context to Turbopack's CSS resolver. Always use `fileURLToPath(new URL(".", import.meta.url))` to get the project root.
- **`turbopack.root` alone does not fix CSS `@import` resolution** — JS and CSS resolution use separate code paths. Bare CSS package imports (e.g. `@import "tailwindcss"`) also require a `resolveAlias` entry pointing to the absolute installed path.
