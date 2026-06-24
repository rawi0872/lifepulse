<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-config -->
# Build & verification commands (run these after code changes)
- Build: `npm run build` (runs Next.js build + TypeScript check)
- Lint: `npm run lint` (Next.js ESLint)
- Dev server: `npm run dev`
- RLS test: `npm run test:rls` (requires Supabase test credentials in env vars)
- Prod smoke test: `npm run test:prod` (runs against production URL using Puppeteer)

## Production Smoke Test (`npm run test:prod`)
- **Credentials** must live only in `.env.test.local` — never commit this file
- Uses the dedicated beta test account (`lifebulse@gmail.com`)
- Tests: public pages, auth protection, login, core app pages (12), save flows (14), feedback dialog, Next Best Action card, finance seeds, passions CRUD, logout
- Requires `.env.test.local` to be present in project root
- `.env.test.local` is gitignored via the `.env*` rule (with `.env.example` exception)
- `playwright-report/`, `test-results/`, and `screenshot-*.png` are gitignored
- Smoke test count is now dynamic (previously 44, now with Body Pro + passions tests)
- Coach engine: `src/lib/coach.ts` — rule-based, no AI, deterministic recommendations. Import `getCoachInsights()`, `getTopInsights()`, types.
<!-- END:project-config -->
