# Phase 030N-M — Distinct subscriptions, outstanding orders and renewal reminders

## Why this release exists

The observed published Starter and Growth plans had the same premium module assignments and no numeric subscription prices. The old admin Upgrade Approvals screen also referred to legacy requests even after Paystack activation was designed to be automatic. An expired prepaid subscription is NOT a debt, and part-paid customer orders must never be mingled with platform billing.

## Changes included

1. `049_standard_plan_tier_controls.sql` creates an audit table and an **explicit System Owner RPC** `admin_apply_standard_plan_matrix('APPLY STANDARD PLANS')`. Installing 049 by itself **does not reconfigure plans**. The admin pricing page now detects duplicate direct module configurations and missing positive published prices, and offers the clearly labelled action to apply a distinct recommended matrix.
2. Recommended matrix: Free stays core-only (SQL 044 controls); Starter `pos`; Growth `pos`, `inventory`, `purchasing`, `team`; Professional Growth modules plus `accounting`, `financial_reports`, `tax`, `insights`, `growth`, `communications`. `campaigns` remains off by default, as external delivery is not finished. Professional is created **unpublished and unpriced** if not already present; existing descriptions/prices are preserved. This uses explicit modules and removes previous inheritance links for those three plans only. The matrix audits prior feature, role and parent-plan rows, who applied it and how many assigned businesses may be affected. Company-specific extras remain untouched.
3. Owner pricing and public website continue to read the actual saved numeric plan prices and `published_plan_features()`. **No prices are invented**. After entering positive monthly or annual prices and configuring the private Paystack keys, customer checkout uses the existing server verification. No manual approval is needed for a verified, eligible checkout.
4. `/admin/renewals` lists prepaid subscriptions whose existing paid period ends within 30 days either side of today. System Owner can manually send an email via existing Resend configuration. SQL 050 logs and deduplicates email attempts by business/expiry/day; send action rechecks current subscription and owner account email. The email cannot create an invoice or charge an account.
5. `/receivables` shows unpaid and part-paid sales orders for the current workspace (latest 200 only, with an explicit scope warning). It allows staff with an authorised sales/finance role to record a schedule of 2–24 instalments and to send an email reminder for a real current unpaid order (only when verified email delivery is configured). SQL 050 stores the arrangement and email attempts with RLS, unique per business and order. The **existing payment recording** is still the only thing that reduces a customer balance. Saving an instalment schedule NEVER posts a payment or initiates a transfer.
6. Admin navigation names legacy review separately from current subscriptions, and business navigation shows the customer receivables page only to authorised roles. Premium modules remain controlled by the existing plan and secure role checks.

## Deployment prerequisites

- Test in a staging Supabase project, and back up the live database before any promotion.
- SQL 048 (and migrations 041–047) must already be installed. Run SQL 049 first, then SQL 050. Neither migration automatically sends emails.
- After SQL 049, **preview affected businesses** before choosing `Apply plan differences`. The UI action **will change effective access for all businesses on Starter, Growth and Professional**, even when they have paid for old features. Company-specific grants are preserved, but their inherited tier features can change. If you have live paid subscribers, review their contracts and obtain agreement before applying the new matrix.
- Use System Owner → Subscription plans to configure numerical monthly/yearly NGN prices and publish the Professional tier only when ready. Free stays ₦0. `PAYSTACK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Supabase URL and secure payment callback must be configured before paid checkout. Never put service-role or secret keys in the browser.
- To enable email reminders, set **server-only** `ENABLE_PLATFORM_EMAIL_DELIVERY=true`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` to a verified sender and appropriate domain. Test the sender in Admin → Email Templates, then verify actual delivery through provider logs. Never tell customers email was delivered merely because Resend accepted the API request.
- Marketing plans and customer subscription access may remain stale for up to a minute in cached public pages; plan changes invalidate tags in the admin action. Check refresh after deployment.

## Test scenarios

1. Admin with no live subscriber: apply standard matrix. The feature comparison shows Starter < Growth < Professional in effective premium modules; Free has none. Repeat action only if another deliberate reset is desired. Audit table records before/after.
2. Admin with existing paying customers: count and review subscriber impact before applying. Confirm any exceptions and re-publish only properly priced tiers.
3. Ensure published Starter and Growth have **different modules and positive prices** before attempting Paystack test checkout. Verify both failure and success: failed or unverified payments must not alter a plan.
4. An authorised business user creates a part-paid order and visits `/receivables`. Set an instalment plan, then record a payment against the original order. Confirm the due amount drops; the schedule alone does not drop it.
5. Another business user must not read or set plans for that order; non-sales staff must not see the receivables menu.
6. Customer email reminder is hidden when sender not configured. When configured and the customer email exists, first send is audited; a second send on the same day is rejected. Confirm the message names the correct business and current due amount. Missing email or fully paid order must never trigger a send.
7. Admin renewals list must not show Free as a debt or infer debts from subscriptions. Send a reminder to a confirmed account email, check activity in Resend. Do not send multiple messages to the same company/period on one day.
8. Re-run the existing 51 source checks and a **complete Vercel `npm run build`**, then test RLS and RPCs with real, separate authenticated accounts. Source-only checks do not establish live functionality.

## Not yet included

- Automatic recurring Paystack debits or automatic dunning cadence; all reminders here are human-initiated.
- Structured customer instalment repayment schedules allocated against individual instalment lines (the plan is informational and always calculates the remaining order balance from actual payments).
- Automatic enforcement of maximum users/branches/transaction volumes for plans, full multi-level workflow permissions or a drag-and-drop plan builder.
- Actual online collection of a customer's instalment. BusinessOS only records confirmed receipts on customer orders.
- Full next build and live end-to-end payment/email testing in this environment.
