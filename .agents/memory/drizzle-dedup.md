---
name: Drizzle ORM deduplication override
description: How to fix SQL<unknown> type conflicts from duplicate drizzle-orm versions in pnpm workspaces
---

## The Problem
When `@clerk/express` (or any opentelemetry-instrumented package) is installed alongside `drizzle-orm`, pnpm installs two copies:
- `drizzle-orm@0.45.2_@types+pg...` (base)
- `drizzle-orm@0.45.2_@opentelemetry+api...` (opentelemetry variant)

TypeScript sees these as different types: `SQL<unknown>` from one copy is not assignable to `SQL<unknown>` from the other, causing errors like:
> "Types have separate declarations of a private property 'shouldInlineParams'"

## The Fix
Add to `pnpm-workspace.yaml` overrides section:
```yaml
drizzle-orm: "0.45.2"
```

Then run `pnpm install` to deduplicate.

**Why:** Forces a single resolved version, removing the opentelemetry-variant copy.

**Side effect:** `@opentelemetry/api` may no longer be installed automatically. Add it as an explicit dependency if any package needs it at runtime:
```
pnpm --filter @workspace/api-server add @opentelemetry/api
```

## Also avoid sql template tags for orderBy
Use `desc(col)` / `asc(col)` from drizzle-orm for `.orderBy()` — these avoid the version conflict. `sql\`col desc\`` passes an SQL object that may be typed from the wrong version.
