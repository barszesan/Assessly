# Repository Guidelines

NextChapter is an Astro 6 SSR application with React 19 interactive islands, Tailwind 4, Supabase auth, and shadcn/ui components, deployed to Cloudflare Workers.

## Hard Rules

- Never use `"use client"` or other Next.js directives — this is Astro, not Next.js.
- Never concatenate Tailwind class strings manually — use the `cn()` helper from `@/lib/utils`.
- Never import server-only code into client React components — env secrets use `astro:env/server` and are inaccessible on the client.
- Always enable RLS on new Supabase tables with granular per-operation, per-role policies.
- Validate all API request input with zod.
- Do not write to `context/archive/` — archived changes are immutable.

## Build & Development

Scripts: see @README.md (`npm run dev`, `build`, `lint`, `lint:fix`, `format`).

Pre-commit hooks run `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}` automatically.

## Project Structure

- `src/pages/` — Astro pages and API routes (`src/pages/api/`)
- `src/components/` — Astro (static) and React (interactive) components
- `src/components/ui/` — shadcn/ui ("new-york" style); add with `npx shadcn@latest add <name>`
- `src/components/hooks/` — extracted React hooks
- `src/lib/` — helpers; `src/lib/services/` for business logic
- `src/types.ts` — shared types and DTOs
- `supabase/migrations/` — named `YYYYMMDDHHmmss_short_description.sql`

Full architecture and auth flow details in @CLAUDE.md.

## Coding Conventions

- Path alias: `@/*` maps to `./src/*` — always use it for imports within `src/`.
- Astro components for layout/static content; React components only when state or interactivity is needed.
- API routes export uppercase HTTP methods (`GET`, `POST`) and set `export const prerender = false`.
- Name components in PascalCase (`.tsx` and `.astro`).
- Prefix unused variables with `_` (enforced by ESLint).
- Merge conditional classes with `cn()` from `@/lib/utils` (clsx + tailwind-merge).

## CI Gate

GitHub Actions runs `lint` → `build` on every push and PR to `master`. Both must pass. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets. See @README.md#ci for details.

## Environment

- Node.js 22.14.0 (see `.nvmrc`)
- Local Cloudflare dev secrets: copy `.env.example` to `.dev.vars`
- Local Supabase: `npx supabase start` (requires Docker)
- Deploy: `npx wrangler deploy`

Full setup instructions in @README.md.
