# BusinessOS Phase 030D Release — Automation Dispatch Foundation

**Status:** Source prepared; no Supabase schema changes executed; no GitHub push or Vercel deployment performed.

### Included

- A secure, business-owner-requested task reminder schedule with Super Admin configuration/activation and pause controls.
- Daily/weekly schedules, capped run counts, owner notifications, protected server-side private POST runner and automated run/queue history.
- Optional Resend sending only for verified, opted-in requesting business owners, with retry leases, idempotency, signed delivery-event tracking, and 40 automation-email-attempt quota per UTC day.
- Free-first approach using existing Supabase and Resend rather than compulsory paid APIs.
- SQL 030 (`supabase/migrations/030_automation_execution.sql`) is **additive, not idempotent**. It must be applied once after 029. An existing object aborts the transaction; never drop tables or rerun older migrations to fix it.
- Inactive/paused by default; no recurring cron job automatically installed.
- Only `task_reminders` are executable in this release; other automation requests remain quote/review only. No customer SMS, WhatsApp, AI API or accounting write actions are introduced.

### Environment

Set `AUTOMATION_RUNNER_SECRET` (server-only, >=32 random characters), `SUPABASE_SERVICE_ROLE_KEY` (server-only) and `NEXT_PUBLIC_SUPABASE_URL`. During installation keep `ENABLE_AUTOMATION_RUNS=false`, `ENABLE_AUTOMATION_EMAIL_DELIVERY=false`. Live sending also requires `ENABLE_PLATFORM_EMAIL_DELIVERY=true`, verified `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

### How to run

Detailed safe rollout and staging tests: `MD/PHASE_030D_AUTOMATION_EXECUTION.md`. Read-only installation verification: `MD/VERIFY_SQL_030_READ_ONLY.sql`. Scheduler is private `POST /api/internal/automation-dispatch` with `Authorization: Bearer <AUTOMATION_RUNNER_SECRET>`.

### Verification

Static routes, TypeScript syntax parsing, Phase 030D source security checks, and earlier project's regression checks pass locally. Full Next.js typecheck/build were not completed because npm package installation was unavailable. Postgres SQL execution, RLS, consent verification, concurrency, real email delivery and browser checks remain pending.

### Documentation

All supporting Markdown files are under `MD/`; root `README.md` is the only top-level `.md` file.
