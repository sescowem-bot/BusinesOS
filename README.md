<div align="center">

# BusinessOS

### Run your business with clarity.

**Customers · Orders · Payments · Invoices · Expenses · Growth**

A practical business-management workspace built for small businesses. Keep the details of everyday work in one place, understand what has been paid, and see what needs attention next.

[Explore the website](https://busines-oss.vercel.app) · [Explore features](https://busines-oss.vercel.app/features) · [Compare plans](https://busines-oss.vercel.app/pricing)

</div>

---

## Why BusinessOS?

Running a business should not mean hunting through notebooks, spreadsheets and chat histories to answer a simple question: *What did we sell, what have we received, and what is still outstanding?*

BusinessOS connects the daily records behind your business—from a customer's first order to an issued invoice and recorded payment. Start with the essentials and expand into additional operational tools when the relevant subscription includes them.

## What you can do

| Everyday essentials | Additional tools on eligible plans |
| --- | --- |
| Maintain customer and contact records | Retail point of sale and recorded checkouts |
| Record orders, services and sales | Stock and inventory workflows |
| Track full payments, part payments and balances | Suppliers and purchasing |
| Manage a product/service catalogue | More advanced teams and branch controls |
| Record business expenses | Financial summaries and exports |
| Prepare available invoices and commercial documents | Accounting and tax record workspaces |
| View your business dashboard | Business insights and growth resources |
| Maintain your business settings | Selected premium modules with time-limited trials |

**Availability matters.** Plan inclusion is configured by the System Owner and must be checked against the published plan, the member's role and existing entitlements. Some advanced financial integrations, reporting and automated communications remain subject to release controls; a visible module does not imply every integration is active.

## How it works

1. **Set up your workspace.** Create an account and enter your business details.
2. **Organise customers and offerings.** Keep contacts, products and services accessible.
3. **Record sales and payments.** Track order progress, partial collections and outstanding balances.
4. **Review and follow up.** Use available invoices, business records and reports to understand your next action.
5. **Grow when ready.** Explore subscription benefits or a specific premium-module trial where offered.

[Get started with a Free workspace](https://busines-oss.vercel.app/signup)

## Made for real businesses

BusinessOS is designed with retailers, wholesalers, service providers and growing teams in mind. It is a responsive web application with an installable experience on supported devices. Staff access and subscription benefits are different controls: a paid plan does not automatically give every employee permission to every action.

## Platform and architecture

| Layer | Technology |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript |
| UI | Responsive, accessible React components and CSS; Lucide icons |
| Identity and application data | Supabase Auth and PostgreSQL |
| Tenant isolation and authorization | Supabase row-level security, database procedures and role-aware server actions |
| Subscription payments | Paystack integration with server-side verification |
| Hosting | Vercel |
| Email and automation | Optional provider-backed services; enabled separately when configured and verified |

The **System Owner console** manages the wider platform, while each business has its own workspace, membership and plan. Tenant-scoped permissions, financial calculations and data migrations must be validated at the database boundary—not only hidden or shown in the UI.

### Repository guide

| Location | Purpose |
| --- | --- |
| `app/` | Routes, layouts, public pages, customer workspaces and System Owner screens |
| `components/` | Shared product and public-site UI |
| `lib/` | Feature catalogues, integrations, business logic and authorization helpers |
| `supabase/migrations/` | Versioned database changes |
| `tests/` and `scripts/` | Automated tests and release checks |
| `MD/` | Engineering notes, implementation detail and rollout acceptance |
| `review/sql/` | Historical evidence and reviewed SQL. Files labelled `APPLIED` are not installation instructions |

## Running locally

**Requirements:** A supported Node.js version for Next.js 16 (Node 22 LTS recommended), npm, and access to a Supabase project.

```bash
git clone https://github.com/sescowem-bot/BusinesOS.git
cd BusinesOS
npm install
cp .env.example .env.local
npm run dev
```

On Windows, copy `.env.example` to `.env.local` using File Explorer or PowerShell.

Configure the environment appropriately for your own development environment:

| Variable | What it configures |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase key (or supported anon-key fallback) |
| `NEXT_PUBLIC_SITE_URL` | Canonical website URL and authentication callback origin |

Provider secrets such as Paystack server keys, Resend keys and the Supabase service-role key are **server-only** and belong in secured environment settings. Never commit credentials or put secrets in `NEXT_PUBLIC_*` variables. Keep third-party services disabled until they are configured.

```bash
npm run typecheck
npm run verify:regressions
npm run test:phase3
npm run build
```

The `.env.example` file and internal documentation explain additional optional integrations. A successful build alone does not certify production accounting or billing.

## Subscriptions and trials

- New business workspaces begin with Free essentials.
- Business owners can choose a published paid plan and continue to the Paystack checkout flow. Subscription activation must follow verified payment.
- The System Owner can manually adjust eligible subscriptions through separate audited controls.
- A trial can provide **one selected premium module to one business for a fixed period**, using an expiring feature grant. It does not charge a card, grant an entire paid plan or silently start a subscription.
- Numerical-limit settings and action permission matrices can be configured, but their full database enforcement remains gated pending transaction-level acceptance.

Current prices and available benefits are managed in the application, **not hardcoded in this README**.

## Security, privacy and release discipline

BusinessOS uses separate account, tenant and plan controls. Data access should always be checked on the server and in PostgreSQL. Financial posting, VAT evidence, returns, subscription upgrades and other sensitive operations must not be made production-active without relevant acceptance checks.

Legal content, retention procedures and vendor settings are managed separately and require the appropriate approvals. This README does **not** assert regulatory certification or lawyer approval.

### What is still being completed

The source contains ongoing work. The following **must not be misrepresented as fully accepted**:

- Complete action-level permission enforcement across authoritative write procedures.
- End-to-end quota enforcement and concurrency testing.
- Permanent POS VAT, invoice and refund accounting reconciliation.
- Successful controlled Paystack payment, webhook and idempotency acceptance.
- Measured route-performance improvements and complete privacy/retention operational acceptance.

For the exact implementation and rollout gates, see [Controlled module trials and release gates](MD/CONTROLLED_MODULE_TRIALS_AND_RELEASE_GATES.md) and [SQL installation/launch evidence](MD/LAUNCH_SQL_AND_ACCEPTANCE_2026-10-24.md). Do **not** rerun a migration just because a historical SQL script appears in the repository.

## Visual direction

Our design principle is **clarity before decoration**: strong typography, useful product previews, expressive but restrained depth, clear calls to action, and a fast accessible mobile experience. We are assessing [React Three Fiber](https://github.com/pmndrs/react-three-fiber) for a *deferred, optional public-site visual*; it is **not a dependency** of the business workspace.

---

<div align="center">

**BusinessOS — Less scattered work. More clarity for every business day.**

[Website](https://busines-oss.vercel.app) · [Product](https://busines-oss.vercel.app/features) · [Contact](https://busines-oss.vercel.app/contact)

</div>
