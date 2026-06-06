---
name: AI SDK v6 breaking changes
description: Key API differences in Vercel AI SDK v6 compared to v4/v5
---

## maxTokens → maxOutputTokens
In AI SDK v6, the `generateText()` and `streamText()` token limit parameter was renamed:
- **Old (v4/v5):** `maxTokens: 1000`
- **New (v6):** `maxOutputTokens: 1000`

Using `maxTokens` in v6 causes a TypeScript error: "does not exist in type CallSettings".

## Express 5 param casting
Express 5 types `req.params.*` as `string | string[]`, not `string`. Always cast before `parseInt`:
```ts
const id = parseInt(req.params.id as string);
```
