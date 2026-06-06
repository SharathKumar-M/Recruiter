# VERIF-AI

A full-stack job platform where students build verified profiles and recruiters use AI to assess candidate authenticity. Students apply to jobs; recruiters review applicants and trigger an AI trust-score analysis that grades each profile 0–100 with a verdict (AUTHENTIC / LIKELY_AUTHENTIC / SUSPICIOUS / FAKE).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/verifai run dev` — run the frontend (port 18418)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter routing, @clerk/react, Tailwind CSS, shadcn/ui, framer-motion
- API: Express 5, @clerk/express middleware
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: Vercel AI SDK (`ai` v6 + `@ai-sdk/openai`) — uses `maxOutputTokens`, not `maxTokens`
- Auth store: Zustand (persisted to localStorage as `verifai-auth-storage`)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema (users, jobs, applications, certificates, verifications)
- `lib/api-client-react/src/generated/` — generated React Query hooks + Zod schemas (do not edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, jobs, student, recruiter, ai)
- `artifacts/api-server/src/middlewares/` — requireAuth, requireStudent, requireRecruiter, clerkProxyMiddleware
- `artifacts/verifai/src/pages/` — React pages (login, student/home, student/profile, recruiter/dashboard, recruiter/jobs, recruiter/profile)
- `artifacts/verifai/src/hooks/use-auth-store.ts` — Zustand store for role + sync state
- `artifacts/verifai/src/components/auth-guard.tsx` — role-based route protection

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → typed React Query hooks. Never write raw `fetch` calls in the frontend.
- **Clerk proxy**: The API server proxies Clerk Frontend API requests through `/api/__clerk` so Replit deployments work without CNAME DNS setup.
- **Role stored in Zustand**: After Clerk sign-up, the user picks a role (student/recruiter) which is stored in Zustand, then synced to the DB via `POST /api/auth/sync`. The role is persisted to localStorage.
- **AI analysis fallback**: If OpenAI is unavailable, the AI route scores the profile heuristically based on which fields are filled in.
- **Drizzle deduplication**: `pnpm-workspace.yaml` overrides `drizzle-orm: "0.45.2"` to prevent duplicate type declarations caused by `@opentelemetry/api` pulling in a separate copy.

## Product

- **Students**: Create a profile with skills, college, LinkedIn/GitHub/portfolio links, resume. Browse and apply to jobs. See application status (pending → reviewed → shortlisted/rejected).
- **Recruiters**: Post jobs, review applicants, change application status. Trigger AI analysis on any student to get a trust score (0–100) + verdict + per-section checks (education, experience, GitHub, certificates).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- AI SDK v6 uses `maxOutputTokens` (not `maxTokens`) in `generateText()`.
- Express 5 route params are typed as `string | string[]` — always cast: `req.params.id as string` before `parseInt`.
- Always import `@/hooks/use-auth-store` (not `./use-auth-store`) from components.
- Run `pnpm run typecheck:libs` before leaf package typechecks whenever you change `lib/db/src/schema/`.
- Do NOT use `sql\`\`` template tags for `.orderBy()` — use `desc()` / `asc()` from drizzle-orm to avoid version conflict errors.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
