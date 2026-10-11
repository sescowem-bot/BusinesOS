# Customer-ready business owner acceptance test

Perform these on a staging preview with a new Free business, one staff account, a paid plan, and a separate second business:

- [ ] Free owner registers once; core Customers, Orders, Products, Expenses, Tasks, Team, Payments and Settings can be opened without platform admin approval.
- [ ] The navigation hides out-of-plan modules, custom automation quotations, placeholder Tasks (replaced by working task register), partners and unfinished campaign sending.
- [ ] Free owner invites staff, copies invitation URL and joins from verified staff email; wrong user email cannot accept. Confirm Resend delivery when enabled and link sharing when not.
- [ ] Staff cannot invite teammates, change other members' roles, or see tasks assigned exclusively to another colleague.
- [ ] Owner changes business-specific member display name; task and team views show familiar names, not UUIDs.
- [ ] Communications selector shows customer names; messages saved as drafts are not incorrectly described as sent.
- [ ] Business logo upload accepts 2MB allowed images and rejects invalid types and other business directory paths.
- [ ] Verify directory remains empty for unverified businesses, and for verified but unpublished businesses. Confirm public profile exposes only explicitly entered public contact details.
- [ ] Owner sees paid prices, uses Paystack test checkout and gets verified plan activation without platform approval.
- [ ] Failed payment, forged callbacks, missing webhook signature, wrong currency, different amount and duplicate events don't grant extra entitlements.
- [ ] Current active paid period is not lost by accidentally buying another plan. Renewal same plan extends expiration and expired plan modules fail closed.
- [ ] No normal customer page shows SQL migration numbers, environment variable names, technical identifiers, backend phases or raw stack traces.
- [ ] Mobile browser/iOS Chrome/Safari and desktop navigation, logo loading, forms and installation steps tested.
- [ ] All routes work on Vercel Preview with applied SQL 044–047 and a clean CI production build.
