---
name: Clerk + Zustand role-based auth flow
description: How VERIF-AI handles student vs recruiter roles with Clerk and Zustand
---

## Flow
1. User lands on `/login` — clicks "Student Login" or "Recruiter Login"
2. `useAuthStore().setRole("student"|"recruiter")` is called before navigating to Clerk's `/sign-in` or `/sign-up`
3. Clerk handles authentication
4. `AuthGuard` detects auth completion and calls `useSyncUser` mutation to POST `/api/auth/sync` with `{ clerkId, email, role, displayName }`
5. Backend upserts user in DB; returns `{ userId, role }`
6. `setSyncComplete(true)` is called — subsequent renders show the role-appropriate dashboard

## Critical detail
The role must be set in Zustand BEFORE the Clerk sign-up flow. If the user refreshes mid-flow, the role persists via `zustand/middleware persist` (key: `verifai-auth-storage`).

## Import paths
- Zustand store: always import from `@/hooks/use-auth-store` — NOT relative `./use-auth-store`
- AuthGuard: lives in `src/components/auth-guard.tsx`
- All useEffect calls must be at top level, never inside conditionals (React rules)
