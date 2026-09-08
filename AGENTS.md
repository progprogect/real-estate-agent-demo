<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules

- Everything in this repository — code, UI copy, docs, comments, commit messages — is strictly in English.
- All user-facing strings live in `src/lib/strings.ts` (i18n-ready); never hard-code copy in components.
- Visual system is defined in `docs/DESIGN_KIT.md`; use the theme tokens from `src/app/globals.css`, no ad-hoc colors.
- AI models and providers are configuration (env vars), never hard-coded; `MOCK_AI=true` must keep the whole flow working offline.
