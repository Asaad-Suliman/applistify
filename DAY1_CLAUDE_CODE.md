# AppListify — Day 1 Instructions for Claude Code

> Read this file top to bottom before touching anything.
> Work inside `/home/asaad/Documents/Project/applistify` for everything.

---

## 0. Read these files first (mandatory)

```bash
cat /home/asaad/Documents/Project/applistify/SYSTEM_DESIGN.md
cat /home/asaad/Documents/Project/applistify/.env.local
find /home/asaad/Documents/Project/applistify \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/.git/*" | sort
```

Do NOT proceed until you have read all three outputs.

---

## 1. Fix known Day 1 issues

### 1a. Delete the wrong file

```bash
rm -f /home/asaad/Documents/Project/applistify/proxy.ts
```

### 1b. Fresh npm install inside the project (not at ~/node_modules)

```bash
cd /home/asaad/Documents/Project/applistify
npm install
```

### 1c. Confirm these packages are present — install any that are missing

```bash
npm list @supabase/ssr @supabase/supabase-js openai zod 2>/dev/null | grep -E "supabase|openai|zod"
```

If any are missing:

```bash
npm install @supabase/ssr @supabase/supabase-js openai zod
```

---

## 2. Fix Tailwind CSS

Replace `postcss.config.mjs` (overwrite completely):

```js
// postcss.config.mjs
/** @type {import('postcss').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
export default config;
```

Replace `tailwind.config.ts` (overwrite completely):

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
```

---

## 3. Create middleware.ts at project root

File: `/home/asaad/Documents/Project/applistify/middleware.ts`

```ts
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

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 4. Create Supabase helpers

### `lib/supabase/server.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}

export function createSupabaseServiceClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
}
```

### `lib/supabase/client.ts`

```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

---

## 5. Create auth components

### `components/auth/LoginForm.tsx`

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h1>
        <p className="text-gray-500 mb-6 text-sm">Sign in to AppListify</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-500">
          No account?{" "}
          <Link href="/signup" className="text-indigo-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### `components/auth/SignupForm.tsx`

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Create account
        </h1>
        <p className="text-gray-500 mb-6 text-sm">
          Start optimizing your app listings
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

## 6. Create auth pages

### `app/(auth)/login/page.tsx`

```tsx
import LoginForm from "@/components/auth/LoginForm";
export default function LoginPage() {
  return <LoginForm />;
}
```

### `app/(auth)/signup/page.tsx`

```tsx
import SignupForm from "@/components/auth/SignupForm";
export default function SignupPage() {
  return <SignupForm />;
}
```

---

## 7. Create dashboard page (stub)

### `app/(app)/dashboard/page.tsx`

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("runs_used")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Signed in as {user.email}</p>
      <p className="mt-1 text-gray-600">
        Runs used: {profile?.runs_used ?? 0} / 10
      </p>
    </main>
  );
}
```

---

## 8. Verify the dev server starts

```bash
cd /home/asaad/Documents/Project/applistify
npm run dev
```

Expected: server starts on `http://localhost:3000` with no errors.

---

## 9. Manual verification checklist

Test these in the browser after the server is running:

- [ ] `http://localhost:3000/signup` — sign up with a new email
- [ ] After signup, browser redirects to `/dashboard`
- [ ] Dashboard shows the email and `Runs used: 0 / 10`
- [ ] `http://localhost:3000/login` — sign in with the same account
- [ ] Login redirects to `/dashboard`
- [ ] Open Supabase dashboard → Table Editor → `profiles` → confirm a row was created

---

## 10. Commit when all checks pass

```bash
cd /home/asaad/Documents/Project/applistify
git add .
git commit -m "Day 1: fix Tailwind, middleware, Supabase helpers, auth forms, dashboard stub"
git push
```

---

## Notes for Claude Code

- **Never overwrite `.env.local`** — it already contains real Supabase keys.
- **Never run schema SQL** — the Supabase database schema is already deployed.
- The `increment_runs_if_available` Postgres function already exists in Supabase — do not recreate it.
- If `npm run dev` throws a TypeScript error in a file not listed above, fix it inline and note what you changed.
- If a file already exists with correct content, skip it — do not overwrite unnecessarily.
