# AppListify — Day 1 Claude Code Prompt

## How to Use This File

1. Open Claude Code in your terminal inside `~/projects/applistify`
2. Paste the prompt at the bottom of this file to start the session
3. Claude Code will show you the folder structure first — approve it, then it will build

---

## Pre-Flight Checklist (do this BEFORE opening Claude Code)

Run these in your terminal:

```bash
# 1. Scaffold the project
cd ~/projects
npx create-next-app@latest applistify --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd applistify

# 2. Install dependencies
npm install @supabase/ssr @supabase/supabase-js openai zod
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dnqwvvkipnlxslpwttre.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then open Claude Code:

```bash
claude
```

---

## Paste This Prompt into Claude Code

```
Read NEXT_CHAT_PROMPT.md — this has the full context of what we built so far.
We are starting Day 1 of the build. Before writing any code:
1. Use the monorepo prompt at the bottom of the file to generate the full folder structure
2. Show me the structure first and wait for my approval
3. After I approve, start building Day 1 tasks one by one
Reference SYSTEM_DESIGN.md for all architecture decisions. Do not deviate from it.
```

---

## What Day 1 Covers (for your reference)

Claude Code will build these in order after you approve the structure:

### Task 1 — Supabase Clients

- `lib/supabase/client.ts` — browser client using `createBrowserClient`
- `lib/supabase/server.ts` — server/RSC client using `createServerClient` with cookie handling

### Task 2 — Middleware

- `middleware.ts` — session refresh on every request using `@supabase/ssr`
- Protects all routes under `/(dashboard)` and redirects unauthenticated users to `/login`

### Task 3 — Auth Components

- `components/auth/LoginForm.tsx` — client component with email/password fields, calls Supabase `signInWithPassword`, redirects to `/optimize` on success
- `components/auth/SignupForm.tsx` — client component with email/password/confirm fields, calls Supabase `signUp`, shows verify email message

### Task 4 — Auth Pages

- `app/(auth)/login/page.tsx` — renders `LoginForm`, links to signup
- `app/(auth)/signup/page.tsx` — renders `SignupForm`, links to login

### Task 5 — Root Layout & Landing Page

- `app/layout.tsx` — root layout with Tailwind, sets metadata
- `app/page.tsx` — checks session, redirects logged-in users to `/optimize`, others to `/login`

### Task 6 — Verification

Claude Code should verify:

- Sign up creates a row in the `profiles` table (via the existing `handle_new_user` trigger in Supabase)
- Login sets the auth cookie correctly
- Logout clears the session and redirects to `/login`
- Unauthenticated access to `/optimize` redirects to `/login`

---

## After Day 1 Is Done

```bash
git add .
git commit -m "Day 1: Project scaffolding and auth"
git push
```

Then save this for Day 2:

> "We finished Day 1. Read NEXT_CHAT_PROMPT.md and SYSTEM_DESIGN.md. We are starting Day 2: Database layer and profile API."
