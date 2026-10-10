# Phase 021 — Deploy & Verification Checklist

1. **Back up** your GitHub main branch and Supabase database. Stage this release on a preview deployment first.
2. ZIP root contains `app`, `components`, `lib`, `supabase`, `proxy.ts`, `package.json` and `docs`. Merge these into the GitHub **repository root**, replacing matching source files; do not nest them in another folder. Keep existing external secrets and data.
3. Your SQL 017–020 has already been reported successful. **Do not rerun it**; optionally run `docs/PHASE_021_DATABASE_PREFLIGHT_READ_ONLY.sql` for verification.
4. Set Vercel `NEXT_PUBLIC_SUPABASE_URL`, one public Supabase key, and `NEXT_PUBLIC_SITE_URL=https://your-businessos-domain` (no trailing slash). The site URL must match the deployment being tested. Ensure Supabase → Authentication → URL Configuration allows `https://your-businessos-domain/auth/callback` (and preview origins in staging).
5. Preserve the existing Resend SMTP configuration. Keep `ENABLE_PLATFORM_EMAIL_DELIVERY=false` until the Auth Hook is deployed and tested.
6. On a computer or CI runner with npm registry access: `npm install`, commit the generated `package-lock.json`, then run `npm ci && npm run check:routes && npm run typecheck && npm run build`. Rebuild and deploy to a preview environment. **Do not claim production readiness if these fail.**
7. Sign in as a Platform Super Admin: `/admin` → `/admin/health` (all services accessible). Check `/admin/content`, `/admin/plan-access`, `/admin/businesses`, `/admin/upgrades`, `/admin/email`, `/admin/notifications`. If premium features are disabled, enable the appropriate features in the correct plan.
8. Sign in as a business owner. Verify `/dashboard`, `/upgrade`, `/notifications`, customers, orders and payments. Request an upgrade and confirm the submission message; Super Admin reviews it; business owner sees the updated assignment and notification.
9. Re-test **role restrictions**: ordinary staff cannot call accounting, campaign, growth and team write actions or download finance exports through direct endpoints when access is denied. Repeat with a business whose approved plan does not include those modules. Separately audit RPC/table access for API-level bypasses before launch.
10. Test Supabase signup email, recovery link/callback, login after token expiry, logout, onboarding success and re-login. Check both desktop and mobile layouts. Review Vercel server logs, Supabase Auth logs and Postgres logs for actual errors.

**Known behaviour:** Admin notification inbox is at `/admin/notifications`; business inbox at `/notifications`. Unread count updates on server navigation, not via realtime subscription. SQL success alone cannot confirm actual function correctness or all legacy records. Dynamic Auth email sender/template switching is not yet enabled.

## Release gate

Only promote to production when all CI checks, database health checks, customer journey and RBAC isolation tests pass in a staging environment. No external payment or email delivery should be activated accidentally.
