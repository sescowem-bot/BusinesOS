# BusinessOS authentication-only hotfix for current deployed source

Use this **authentication-only** patch before deploying the complete Phase 030L POS upgrade if the latest DB migrations are not installed. The patch is designed against `sescowem-bot/BusinesOS` main's authentication files as observed on 10 October 2026.

## Apply

1. Open a GitHub review branch from the **current deployed version**. Back up the current source.
2. Merge the files inside `app/(auth)/` and `lib/auth-feedback.ts` into matching paths. Replace `app/admin/email/page.tsx` only after reviewing the existing version; the change clarifies SMTP versus application notification email settings.
3. **Do not replace your current `app/globals.css`.** Instead, open `MD/AUTH_UI_STYLES_APPEND.css` from this package, copy its CSS to the **end** of `app/globals.css` and commit.
4. There is no new SQL in this hotfix. Keep your current DB migrations untouched. This hotfix does not depend on POS migrations 031–040.
5. Configure custom SMTP in Supabase Authentication → Emails → SMTP Settings. Resend SMTP host `smtp.resend.com`, port `465` for SSL, username `resend`, password a verified sender's Resend API key, sender an address on your verified domain. Never put the key in client code.
6. Supabase Auth URL Configuration: Site URL must match your deployed origin (`https://busines-oss.vercel.app` for the shown deployment) and the redirect allow-list must include `https://busines-oss.vercel.app/auth/callback`. Vercel `NEXT_PUBLIC_SITE_URL` must match.
7. Confirm rate-limit settings and test **one** signup, confirmation callback, sign-in and password recovery flow. Avoid repeatedly hitting signup while rate-limited.
8. Build and test in Vercel Preview before production, and do not push/deploy without the repository owner's approval.

The patch only changes what people see and how your application interprets Supabase Auth errors. It does **not** increase Supabase's mail quota or deliver an email on its own.

Use the full-source archive instead only after migrations 031–040 are staged and all POS acceptance tests pass.
