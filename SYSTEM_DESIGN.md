# AppListify — System Design

> Cross-referenced with:
>
> - `~/architect-hub/system-design-primer` (database, API, scaling patterns)
> - `~/architect-hub/machine-learning-systems-design` (AI serving, prompt design, error handling)

---

## 1. System Overview

AppListify is a server-side AI service that accepts a structured app description from an authenticated user and returns three optimized App Store listing variants per run. Each user receives 10 free runs enforced at the database layer. Variants can be localized into 5 languages. All outputs are persisted and browsable via a history dashboard.

The system is a thin Next.js App Router application backed by Supabase (auth + Postgres + RLS) and OpenAI (gpt-4o-mini). There is no payment layer; the hard cap is the product boundary.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (Next.js)                       │
│                                                                  │
│  /login  /signup  /dashboard  /optimize  /history  /result/:id  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js App Router (Vercel)                    │
│                                                                  │
│  Server Components (RSC) ──► fetch Supabase directly (SSR)      │
│                                                                  │
│  Route Handlers (API)                                            │
│   POST /api/optimize      ◄── protected, runs quota check       │
│   POST /api/localize      ◄── protected, no quota cost          │
│   GET  /api/history       ◄── protected                         │
└────────────┬────────────────────────────┬────────────────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────┐   ┌────────────────────────────────────┐
│   Supabase (Postgres)  │   │         OpenAI API                 │
│                        │   │  model: gpt-4o-mini                │
│  profiles              │   │  server-side only (Route Handler)  │
│  optimizations         │   │  3 variants per call               │
│  variants              │   └────────────────────────────────────┘
│  localizations         │
│                        │
│  RLS on every table    │
│  Trigger: auto-profile │
└────────────────────────┘
```

Data flow for an optimization run:

```
User submits form
      │
      ▼
POST /api/optimize (Route Handler, server only)
      │
      ├─► 1. Verify Supabase session (server client)
      │
      ├─► 2. BEGIN TRANSACTION
      │       SELECT runs_used FROM profiles WHERE id = user_id FOR UPDATE
      │       IF runs_used >= 10 → ROLLBACK → return 403
      │       UPDATE profiles SET runs_used = runs_used + 1
      │       INSERT INTO optimizations (...)
      │       COMMIT
      │
      ├─► 3. Call OpenAI API (structured JSON prompt)
      │
      ├─► 4. INSERT 3 rows into variants
      │
      └─► 5. Return optimization_id + variants to client
```

---

## 3. Tech Stack Decisions

| Layer                  | Choice                | Reason                                                                                                                                                   |
| ---------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend framework** | Next.js 14 App Router | Server Components eliminate client-side data fetching for history/dashboard; route handlers keep OpenAI key server-side                                  |
| **Database + Auth**    | Supabase (PostgreSQL) | ACID transactions (system-design-primer §RDBMS) guarantee atomic quota decrement; RLS enforces per-user data isolation without application-layer guards  |
| **AI model**           | gpt-4o-mini           | ML systems design §Serving: "start with the simplest model that can do the job" — gpt-4o-mini hits the quality bar at lower latency and cost than gpt-4o |
| **Styling**            | Tailwind CSS          | No build-time overhead; utility-first maps directly to component states                                                                                  |
| **Deployment**         | Vercel                | Zero-config Next.js; Fluid Compute handles 300s timeout needed for OpenAI calls                                                                          |

**Why PostgreSQL over NoSQL (system-design-primer §SQL or NoSQL):**
The usage limit is a counter that must be incremented atomically. NoSQL BASE semantics risk double-spend under concurrent requests. PostgreSQL ACID with `SELECT ... FOR UPDATE` is the correct pattern.

**Why server-side inference (ML systems design §Serving):**
OpenAI key never reaches the browser. Server-side inference also lets us log every prompt/response for future fine-tuning or abuse detection.

---

## 4. Database Schema

### SQL

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES (one row per auth.users row)
-- ─────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  runs_used    int  not null default 0 check (runs_used >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- OPTIMIZATIONS (one per run)
-- ─────────────────────────────────────────
create table public.optimizations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  app_name        text not null,
  category        text not null,
  features        text not null,
  target_audience text not null,
  competitors     text,
  platform        text not null check (platform in ('ios', 'android', 'both')),
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- VARIANTS (3 per optimization)
-- ─────────────────────────────────────────
create table public.variants (
  id              uuid primary key default gen_random_uuid(),
  optimization_id uuid not null references public.optimizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  variant_index   int  not null check (variant_index between 1 and 3),
  title           text not null,
  subtitle        text not null,
  description     text not null,
  keywords        text[] not null,
  screenshot_text text[] not null,
  created_at      timestamptz not null default now(),
  unique (optimization_id, variant_index)
);

-- ─────────────────────────────────────────
-- LOCALIZATIONS (per variant, per language)
-- ─────────────────────────────────────────
create table public.localizations (
  id           uuid primary key default gen_random_uuid(),
  variant_id   uuid not null references public.variants(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  language     text not null check (language in ('es', 'fr', 'de', 'ja', 'ar')),
  title        text not null,
  subtitle     text not null,
  description  text not null,
  keywords     text[] not null,
  created_at   timestamptz not null default now(),
  unique (variant_id, language)
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.optimizations enable row level security;
alter table public.variants      enable row level security;
alter table public.localizations enable row level security;

-- profiles: own row only
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id);

-- optimizations: own rows only
create policy "optimizations: own rows" on public.optimizations
  for all using (auth.uid() = user_id);

-- variants: own rows only
create policy "variants: own rows" on public.variants
  for all using (auth.uid() = user_id);

-- localizations: own rows only
create policy "localizations: own rows" on public.localizations
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index on public.optimizations (user_id, created_at desc);
create index on public.variants      (optimization_id);
create index on public.localizations (variant_id, language);
```

### TypeScript Types

```typescript
export type Platform = "ios" | "android" | "both";
export type Language = "es" | "fr" | "de" | "ja" | "ar";

export interface Profile {
  id: string;
  email: string;
  runs_used: number;
  created_at: string;
  updated_at: string;
}

export interface Optimization {
  id: string;
  user_id: string;
  app_name: string;
  category: string;
  features: string;
  target_audience: string;
  competitors: string | null;
  platform: Platform;
  created_at: string;
}

export interface Variant {
  id: string;
  optimization_id: string;
  user_id: string;
  variant_index: 1 | 2 | 3;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  screenshot_text: string[];
  created_at: string;
}

export interface Localization {
  id: string;
  variant_id: string;
  user_id: string;
  language: Language;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  created_at: string;
}

export interface OptimizationInput {
  app_name: string;
  category: string;
  features: string;
  target_audience: string;
  competitors?: string;
  platform: Platform;
}
```

---

## 5. API Routes

All routes live under `app/api/`. Every route uses the Supabase server client (cookies-based session — no token in body).

### `POST /api/optimize`

**Auth:** Required  
**Cost:** Consumes 1 run (atomic, server-enforced)

Request body:

```json
{
  "app_name": "string",
  "category": "string",
  "features": "string",
  "target_audience": "string",
  "competitors": "string | undefined",
  "platform": "ios | android | both"
}
```

Response `200`:

```json
{
  "optimization_id": "uuid",
  "variants": [
    {
      "id": "uuid",
      "variant_index": 1,
      "title": "string",
      "subtitle": "string",
      "description": "string",
      "keywords": ["string"],
      "screenshot_text": ["string"]
    }
  ],
  "runs_remaining": 7
}
```

Response `403`: `{ "error": "run_limit_reached" }`  
Response `422`: `{ "error": "validation_error", "details": {...} }`  
Response `502`: `{ "error": "ai_unavailable" }` (OpenAI failure)

---

### `POST /api/localize`

**Auth:** Required  
**Cost:** No run consumed

Request body:

```json
{
  "variant_id": "uuid",
  "language": "es | fr | de | ja | ar"
}
```

Response `200`:

```json
{
  "localization": {
    "id": "uuid",
    "language": "es",
    "title": "string",
    "subtitle": "string",
    "description": "string",
    "keywords": ["string"]
  }
}
```

---

### `GET /api/history`

**Auth:** Required  
**Returns:** User's optimizations with nested variants (no localizations inline)

Response `200`:

```json
{
  "optimizations": [
    {
      "id": "uuid",
      "app_name": "string",
      "platform": "ios",
      "created_at": "iso8601",
      "variants": [{ "id": "uuid", "variant_index": 1, "title": "string" }]
    }
  ]
}
```

---

### `GET /api/profile`

**Auth:** Required  
**Returns:** `{ runs_used: number, runs_remaining: number }`

---

## 6. AI Integration Design

### Pattern (ML Systems Design §Serving)

Server-side inference only. The OpenAI key never leaves the Route Handler. Every call is logged (optimization_id + response) to support future fine-tuning or abuse audit.

### Prompt Template — Optimization

```typescript
function buildOptimizationPrompt(input: OptimizationInput): string {
  return `You are an expert App Store Optimization (ASO) copywriter.

Generate exactly 3 distinct optimized App Store listing variants for the following app.

App Details:
- Name: ${input.app_name}
- Category: ${input.category}
- Key Features: ${input.features}
- Target Audience: ${input.target_audience}
- Competitors: ${input.competitors ?? "none provided"}
- Platform: ${input.platform}

Rules:
- Title: max 30 characters
- Subtitle: max 30 characters
- Description: 150–170 words, benefit-led, no buzzwords
- Keywords: exactly 10 comma-separated terms, no spaces around commas
- Screenshot text: exactly 3 short phrases (max 6 words each) for store screenshots
- Each variant must be meaningfully different in angle (e.g. benefit-led vs social-proof vs feature-led)

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "variants": [
    {
      "variant_index": 1,
      "title": "...",
      "subtitle": "...",
      "description": "...",
      "keywords": ["...", ...],
      "screenshot_text": ["...", "...", "..."]
    },
    { "variant_index": 2, ... },
    { "variant_index": 3, ... }
  ]
}`;
}
```

### Prompt Template — Localization

```typescript
function buildLocalizationPrompt(variant: Variant, language: Language): string {
  const languageNames: Record<Language, string> = {
    es: "Spanish",
    fr: "French",
    de: "German",
    ja: "Japanese",
    ar: "Arabic",
  };
  return `Translate the following App Store listing into ${languageNames[language]}.
Preserve meaning and ASO intent. Respect character limits (title/subtitle: 30 chars).
Keep keywords relevant for ${languageNames[language]}-speaking markets.

Source listing:
${JSON.stringify({ title: variant.title, subtitle: variant.subtitle, description: variant.description, keywords: variant.keywords })}

Respond ONLY with valid JSON:
{
  "title": "...",
  "subtitle": "...",
  "description": "...",
  "keywords": ["...", ...]
}`;
}
```

### OpenAI Call with Error Handling

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateVariants(input: OptimizationInput) {
  let raw: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: buildOptimizationPrompt(input) }],
      temperature: 0.8,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0].message.content ?? "";
  } catch (err) {
    // ML Systems Design §Serving: distinguish transient vs permanent failures
    throw new AIServiceError("openai_call_failed", err);
  }

  let parsed: { variants: Variant[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AIServiceError("json_parse_failed", raw);
  }

  if (!Array.isArray(parsed.variants) || parsed.variants.length !== 3) {
    throw new AIServiceError("unexpected_shape", parsed);
  }

  return parsed.variants;
}

export class AIServiceError extends Error {
  constructor(
    public code: string,
    public detail: unknown,
  ) {
    super(code);
  }
}
```

**Error handling policy:**

- `openai_call_failed` → return `502 ai_unavailable`; run quota is NOT decremented (transaction rolled back before AI call)
- `json_parse_failed` → retry once with temperature 0.2; if still fails, return `502`
- Quota decrement happens BEFORE the OpenAI call; if OpenAI fails, we do NOT refund automatically on first implementation (acceptable UX tradeoff, noted for v2)

---

## 7. Usage Limiting Logic

**Pattern (system-design-primer §ACID transactions):** The counter is incremented inside a serializable transaction with a row-level lock (`SELECT ... FOR UPDATE`) to prevent race conditions under concurrent requests from the same user.

```typescript
// app/api/optimize/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role bypasses RLS for atomic update
    { cookies: { getAll: () => cookies().getAll(), setAll: () => {} } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Validate input
  const body = await req.json();
  const validation = validateOptimizationInput(body);
  if (!validation.ok)
    return Response.json(
      { error: "validation_error", details: validation.errors },
      { status: 422 },
    );

  // Atomic quota check + increment via Postgres function
  const { data, error } = await supabase.rpc("increment_runs_if_available", {
    p_user_id: user.id,
    p_limit: 10,
  });

  if (error || !data.allowed) {
    return Response.json({ error: "run_limit_reached" }, { status: 403 });
  }

  // Insert optimization record
  const { data: opt } = await supabase
    .from("optimizations")
    .insert({ user_id: user.id, ...body })
    .select("id")
    .single();

  // Call OpenAI (after quota is consumed)
  let variants;
  try {
    variants = await generateVariants(body);
  } catch (err) {
    // Refund is NOT automatic in v1; log for manual review
    console.error("AI generation failed after quota decrement", {
      user_id: user.id,
      opt_id: opt.id,
      err,
    });
    return Response.json({ error: "ai_unavailable" }, { status: 502 });
  }

  // Persist variants
  await supabase.from("variants").insert(
    variants.map((v) => ({
      ...v,
      optimization_id: opt.id,
      user_id: user.id,
    })),
  );

  return Response.json({
    optimization_id: opt.id,
    variants,
    runs_remaining: 10 - data.new_runs_used,
  });
}
```

**Postgres function for atomic increment:**

```sql
create or replace function public.increment_runs_if_available(
  p_user_id uuid,
  p_limit   int default 10
)
returns json language plpgsql security definer as $$
declare
  v_runs int;
begin
  select runs_used into v_runs
  from public.profiles
  where id = p_user_id
  for update; -- row-level lock prevents concurrent over-spend

  if v_runs >= p_limit then
    return json_build_object('allowed', false, 'new_runs_used', v_runs);
  end if;

  update public.profiles
  set runs_used = runs_used + 1, updated_at = now()
  where id = p_user_id;

  return json_build_object('allowed', true, 'new_runs_used', v_runs + 1);
end;
$$;
```

---

## 8. Auth Flow

```
1. User visits /signup
   └─► supabase.auth.signUp({ email, password })
       └─► Supabase creates auth.users row
           └─► Trigger: handle_new_user() creates profiles row
               └─► Redirect to /dashboard

2. User visits /login
   └─► supabase.auth.signInWithPassword({ email, password })
       └─► Supabase issues JWT (stored in httpOnly cookie via @supabase/ssr)
           └─► Redirect to /dashboard

3. Every Server Component / Route Handler
   └─► createServerClient(url, anon_key, { cookies })
       └─► supabase.auth.getUser() — validates JWT server-side
           └─► If null → redirect('/login')

4. Session refresh
   └─► Supabase @supabase/ssr auto-refreshes token via middleware
       └─► app/middleware.ts: updateSession() on every request

5. Logout
   └─► supabase.auth.signOut()
       └─► Clears cookie → redirect('/login')
```

**middleware.ts:**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser(); // refreshes session cookie if needed
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 9. Component Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx              # Login form (client component)
│   └── signup/
│       └── page.tsx              # Signup form (client component)
├── (app)/
│   ├── layout.tsx                # Shared layout with nav + run counter
│   ├── dashboard/
│   │   └── page.tsx              # RSC: fetches profile + recent optimizations
│   ├── optimize/
│   │   └── page.tsx              # Optimize form page
│   ├── history/
│   │   └── page.tsx              # RSC: full history list
│   └── result/
│       └── [id]/
│           └── page.tsx          # RSC: single optimization + variants
├── api/
│   ├── optimize/route.ts
│   ├── localize/route.ts
│   ├── history/route.ts
│   └── profile/route.ts
└── middleware.ts

components/
├── auth/
│   ├── LoginForm.tsx             # email/password form, calls supabase client
│   └── SignupForm.tsx
├── optimize/
│   ├── OptimizeForm.tsx          # Controlled form, POST /api/optimize
│   ├── RunCounter.tsx            # Shows X/10 runs used
│   └── LimitReachedBanner.tsx    # Shown when runs_used >= 10
├── variants/
│   ├── VariantCard.tsx           # Single variant display
│   ├── VariantTabs.tsx           # Tab switcher for 3 variants
│   ├── LocalizeButton.tsx        # Triggers POST /api/localize
│   └── LocalizedVariant.tsx      # Displays localized result
└── history/
    ├── HistoryList.tsx           # List of past optimizations
    └── HistoryItem.tsx           # Summary row with link to /result/:id

lib/
├── supabase/
│   ├── server.ts                 # createServerClient helper
│   └── client.ts                 # createBrowserClient helper
├── openai/
│   ├── prompts.ts                # buildOptimizationPrompt, buildLocalizationPrompt
│   └── generate.ts               # generateVariants, generateLocalization
├── validation/
│   └── optimize.ts               # Zod schema for OptimizationInput
└── types.ts                      # All shared TypeScript types
```

---

## 10. Daily Build Task Breakdown

### Day 1 — Project Scaffolding & Auth

- `npx create-next-app@latest applistify --typescript --tailwind --app`
- Install: `@supabase/ssr`, `@supabase/supabase-js`, `openai`, `zod`
- Create Supabase project; run schema SQL (profiles, trigger, RLS)
- Implement middleware.ts (session refresh)
- Build LoginForm + SignupForm (client components)
- Build `(auth)/login` and `(auth)/signup` pages
- Verify: signup creates profile row; login sets cookie; logout clears it

### Day 2 — Database Layer & Profile

- Run remaining schema SQL (optimizations, variants, localizations, indexes)
- Create `increment_runs_if_available` Postgres function
- Build `lib/supabase/server.ts` and `lib/supabase/client.ts`
- Build `GET /api/profile` route
- Build `RunCounter` component
- Build dashboard page (RSC, shows run count + empty state)
- Verify: RLS blocks cross-user data access

### Day 3 — Optimize Form & AI Integration

- Build `lib/openai/prompts.ts` with `buildOptimizationPrompt`
- Build `lib/openai/generate.ts` with `generateVariants` + error handling
- Build `lib/validation/optimize.ts` (Zod schema)
- Build `POST /api/optimize` route (quota → insert → AI → variants)
- Build `OptimizeForm` component
- Build `optimize/page.tsx`
- Verify: 3 variants returned; quota increments; limit blocks at 10

### Day 4 — Result Page & Variant Display

- Build `VariantCard`, `VariantTabs` components
- Build `result/[id]/page.tsx` (RSC fetches optimization + variants)
- Add redirect from OptimizeForm submit to `/result/:id`
- Build `LimitReachedBanner` component
- Verify: all 3 variants display correctly; banner shows at limit

### Day 5 — Localization

- Build `buildLocalizationPrompt` in `lib/openai/prompts.ts`
- Build `generateLocalization` in `lib/openai/generate.ts`
- Build `POST /api/localize` route (no quota cost; idempotent via unique constraint)
- Build `LocalizeButton` + `LocalizedVariant` components
- Wire language selector to `LocalizeButton`
- Verify: all 5 languages; re-localizing same language returns cached DB row

### Day 6 — History Dashboard

- Build `GET /api/history` route
- Build `HistoryList` + `HistoryItem` components
- Build `history/page.tsx` (RSC)
- Update dashboard page to show 3 most recent optimizations
- Add navigation between pages
- Verify: history shows correct optimizations per user; no cross-user leakage

### Day 7 — Polish, Error States & Deployment

- Add loading states / skeleton UI to OptimizeForm and result page
- Add error boundaries for AI failures (502 handling in client)
- Add empty states for history and dashboard
- Set Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
- Deploy to Vercel; verify prod auth flow end-to-end
- Final check: RLS, quota enforcement, localization, history all working in prod
