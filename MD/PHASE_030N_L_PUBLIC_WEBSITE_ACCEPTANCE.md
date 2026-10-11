# BusinessOS — Public website acceptance for Phase 030N-L

## Demonstration path

1. **Homepage `/`**: hero explains concrete value, CTA goes to signup, product preview is labelled as an illustration, real modules are introduced, business solutions and current published plans appear.
2. **Features `/features`**: six core capability cards; six plan-gated modules; example customer order with part payments and remaining balance. The sample money is explicitly labelled illustrative.
3. **Solutions `/solutions`**: retail, wholesale, services and team workflows are different and actionable. No fabricated case studies.
4. **How it works `/how-it-works`**: five steps and one complete order workflow, with FAQs about teams and payments.
5. **Pricing `/pricing`**: cards reflect the actual published plan names, monthly/annual values and assigned modules. The comparison table must show included/not included correctly. No guessed amounts.
6. **About `/about`**, **Resources `/resources`**, **Contact `/contact`**: actual purpose/values, six useful business guides, and valid configured WhatsApp/email/phone links.

## CMS / brand checks

- Update Homepage title, eyebrow and description through `/admin/content/home`, save and refresh. The new content must appear on public Home.
- Update sections through `/admin/content/features`, `/admin/content/solutions`, `/admin/content/how-it-works`; changes should appear in the additional editorial blocks. The product-specific layout itself is currently code-defined.
- Mark a test non-home page unpublished and verify the public page does not show a default fallback. Restore publication after testing.
- Change the platform name in Brand Studio; check the navigation logo, preview initials, footer and page metadata.
- Set WhatsApp in Brand Studio and check the direct URL with a real device; unset it and confirm no dead link.
- Add a monthly and yearly amount to a *published* plan and confirm it appears exactly on `/pricing`. Check its `platform_plan_features` assignments reflected in public comparison; do not assume `features` marketing notes enable access.

## Mobile checks

Check 320px, 375px, 390px, 768px, 1024px and desktop width. No horizontal scrolling except the labelled comparison table. Verify focus indicators, keyboard access to FAQ details and all CTA links. Confirm navigation works on Safari iOS, Chrome iOS and Android Chrome.

## Performance checks

- Inspect public performance on Vercel Preview. Check page requests and network waterfall without an authenticated user.
- Marketing sections should not trigger authenticated workspace RPCs.
- Confirm the existing public CMS and published-plans calls are cached and no new unbounded client fetch occurs.
- Verify image assets are sized and brand logo URL is trusted, available and optimised separately.

## Release gate

Source parser and static tests alone are **not sufficient**. Run `npm run typecheck`, `npm run build`, and real browser testing. Do not describe the public website or checkout as production-certified without those checks and a live test.
