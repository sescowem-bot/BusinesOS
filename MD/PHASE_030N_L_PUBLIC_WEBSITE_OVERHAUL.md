# Phase 030N-L — Complete public product marketing upgrade

## Objective
Replace the generic public website with credible, detailed, product-specific pages. **This release changes code, content and responsive layouts**, not just copy suggestions.

## Updated experiences

- **Home:** Strong product positioning, actual business use cases and capability tiles, a four-step order-to-payment narrative, industry-oriented solution cards, and a dynamic preview of up to four *published* plans. The preview is labelled illustrative; no fabricated testimonials, company counts or revenue statistics.
- **Features:** Dedicated core feature catalogue and detailed advanced modules. Includes a clearly labelled sample payment workflow and real examples of available POS, purchasing, stock, finance, invoices and exports. Plan-dependent capabilities are described as such.
- **Solutions:** Four detailed cards for retail stores, wholesalers/distributors, service businesses and growing teams. Every card describes a problem, a realistic workflow and relevant tools. No case study invents a real customer.
- **How It Works:** Five sequential onboarding-to-review steps, a visual four-step order workflow, and questions about plan access, staff invitations and recording payments.
- **Pricing:** Dynamic published plans with monthly/yearly NGN terms where configured, plain CTA actions, core capabilities, plan-entitled modules, a detailed per-plan comparison and FAQs. No fabricated subscription prices. Custom plans without configured prices use 'Custom quote'. External billing must still be verified on staging.
- **About:** Clear product values without unsubstantiated business history or claims.
- **Resources:** Six detailed, useful operational guides, distinct from generic marketing cards.
- **Contact:** Channel-specific entry points for WhatsApp, email and phone from System Owner branding. Links are omitted unless a valid channel is configured.
- **Metadata:** Homepage and Pricing SEO titles use the current platform brand instead of hardcoding BusinessOS.

## CMS integration

The stored CMS **page title, eyebrow and introduction** remain primary on Home, Features, Solutions and How It Works. **CMS content sections appear as separate, editable editorial blocks** on the relevant page. Legacy stock CMS intros from previous releases are upgraded automatically only if they exactly match old stock copy; custom owner content is preserved. Explicitly unpublished non-home pages no longer reappear due to a stock fallback. Structured product demonstrations, curated comparison illustrations and layout templates are code-defined in this release, **not a complete drag-and-drop visual CMS**. They require a future structured visual-editing schema for editing without code.

Pricing is backed by `public_site_plans` and the `published_plan_features` RPC, so a plan or its price must be published in the System Owner editor before customers can see that amount. The platform never guesses a price. The public comparison shows actual enabled modules, not marketing notes that don't grant entitlement.

## Performance

No new JavaScript animation framework, external image dependency, client API polling or background database fetch was added. Public page and published plan readers use the existing cached Supabase queries (60-second revalidation). The new pages use server-rendered semantic HTML and responsive CSS. The dynamic pricing table is scrollable on narrow devices.

## Installation

Use the cumulative ZIP because earlier releases may not have been pushed. Compare with the GitHub branch and preserve newer changes. Apply on a review branch and run:

```
npm ci # only when a compatible package-lock.json exists
npm run check:routes
node scripts/verify-phase30n-l-public-product.cjs
npm run typecheck
npm run build
```

**No new SQL migration is required** for this marketing change. The new public website can be code-deployed independently from SQL 048. Plan pricing/entitlement accuracy depends on earlier CMS and published-plan migrations already applied.

## Deployment acceptance

1. View Home, Features, Solutions, How It Works, Pricing, About, Resources and Contact in desktop and mobile browsers.
2. Check that every CTA navigates to a working route.
3. Configure a published plan's monthly and annual price in System Owner and confirm that exact amount appears in Pricing and the Homepage preview after revalidation.
4. Confirm that included modules precisely match the plan permissions and that a disabled module shows as not included.
5. Edit a CMS heading, introduction and editorial section; verify it appears on the live page after the cache refresh.
6. Change the platform name in Brand Studio and check website logo text, marketing preview initials, homepage and pricing metadata.
7. Configure the WhatsApp phone; confirm a valid `wa.me` link opens. Unset it to confirm no broken button appears.
8. Run real Vercel production build and check network timings, accessibility and navigation on phone.

## Known scope limits

- No invented actual plan amounts: configure prices in System Owner.
- Some current product integrations (external messaging, full campaigns, automated tax filing and bank payment collection) remain not live and are deliberately not advertised as enabled modules.
- Dedicated sections use code-defined marketing templates; the CMS controls the intro and additional editorial sections but not every individual demo-card field.
- Production build, database availability and actual physical browser/phone checks remain to be performed on a connected deployment.
