# AppListify — Project Brief for System Design

## Your Role

Act as a Senior System Architect. Read and cross-reference these two repositories before designing anything:

1. `~/architect-hub/system-design-primer` — use for database design, scaling patterns, API design
2. `~/architect-hub/machine-learning-systems-design` — use for AI/LLM integration patterns, prompt design, reliable AI response handling

Cross-reference patterns from both repos in every decision you make.

---

## What the App Does

AppListify is an AI-powered App Store Listing Optimizer.

- User signs up / logs in (Supabase auth)
- They fill a form: app name, category, features, target audience, competitors, platform (iOS / Android / Both)
- AI generates 3 optimized app store listing variants per run:
  - Title, subtitle, description, keyword set, screenshot text suggestions
- Each user gets **10 free runs total** — tracked in the database
- No payments, no subscriptions — when limit is reached, show a friendly message
- Users can localize any variant into 5 languages: Spanish, French, German, Japanese, Arabic
- All past optimizations are saved and viewable in a history dashboard

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router, TypeScript)
- **Database + Auth:** Supabase (PostgreSQL + Row Level Security)
- **AI:** OpenAI API (gpt-4o-mini)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

---

## What to Produce

Generate a file called `SYSTEM_DESIGN.md` in the project root with these sections:

1. **System overview** — what the app does in plain language
2. **Architecture diagram** — text-based ASCII or markdown diagram
3. **Tech stack decisions** — why each tool, referencing patterns from the repos
4. **Database schema** — all tables, columns, types, RLS policies, auto-profile trigger (include actual SQL)
5. **API routes** — every endpoint, what it does, auth requirements, request/response shape
6. **AI integration design** — prompt structure, response parsing, error handling (reference ML systems design repo patterns)
7. **Usage limiting logic** — exactly how the 10-run limit is enforced server-side
8. **Auth flow** — signup → profile creation → session management
9. **Component structure** — all pages and reusable components
10. **Daily build task breakdown** — split the entire build into sequential daily tasks, each building on the previous

Be specific — include actual SQL, actual TypeScript types, actual prompt templates. Reference specific patterns from the two repos where relevant.
