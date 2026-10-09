# Landing and registration repair

- New public-only responsive navigation, sales-led homepage, CSS-rendered dashboard concept and sections for features, solutions, process, reasons, FAQs and footer.
- No invented testimonials, published prices or unsupported regulatory compliance guarantees.
- Supabase accepts the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` OR the newer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not a secret/service role key).
- Signup form now reports provider authentication errors clearly rather than suppressing them.
- `/api/setup-status` discloses only whether public Supabase configuration values are present and URL valid, never the key values. Its output is diagnostic, not proof of live Supabase connectivity.
- Configure the SAME env variables in the correct Vercel project for Production/Preview as appropriate; redeploy after any changes.
- Supabase Authentication > Providers > Email must be enabled. Configure URL redirect allowlist and email verification settings. Supabase migrations are still required for workspace creation but not to resolve missing frontend environment variables.
- `NEXT_PUBLIC_APP_URL` may be set to your deployment domain for future redirect handling.
- Do not expose `service_role` or secret API keys in NEXT_PUBLIC variables.
- Demo dashboard shown in the hero is labelled illustrative, not a real customer screenshot.
