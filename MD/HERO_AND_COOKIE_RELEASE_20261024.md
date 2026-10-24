# BusinessOS hero and cookie experience — 24 October 2026

## Marketing hero
- React Three Fiber was reviewed against its stable React 19 compatibility and performance guidance. It is **not installed**: the initial landing page uses a fast, interactive CSS aurora, product preview, restrained depth and explicit clickable product highlights.
- All animations respect OS reduced-motion preferences, and the cookie panel stores an optional per-browser visual preference that disables decorative hero motion.
- No invented financial dashboard figures, heavier JS animation loop, Canvas/WebGL startup or extra npm packages.
- The hero's interaction does not gate onboarding, product access, login or checkout.

## Cookie choices
- A new v3 notice is shown once to visitors (including browsers that acknowledged v2). Choosing **Necessary only** stores only the first-party notice choice, while **Customise** opens a proper settings dialog.
- A meaningful optional visual preference is saved as `businessos_visual_motion_v1` and changes the marketing hero's motion. Switching it off removes that optional cookie.
- Analytics and advertising categories accurately say **Not in use** rather than displaying false consent controls. No third-party analytics or marketing tags are activated by this implementation. If any future trackers are introduced, they must be gated behind fresh affirmative consent, with the provider inventory and privacy notices updated first.
- After saving, visitors can reopen choices from a small Privacy choices button or the website footer.
- A first version of the Cookie Notice CMS page was added and published to existing production Supabase. It can be edited from System Owner > Website Pages. This does **not** claim an independent legal signoff.

## Release evidence
Historical content migration `publish_initial_editable_cookie_notice_v3` was applied to the existing Supabase instance. Do NOT rerun the stored copy. Frontend source tests assert key choices, accessibility and reduced-motion behavior; GitHub/Vercel builds still need to pass before marking the website update as deployed.
