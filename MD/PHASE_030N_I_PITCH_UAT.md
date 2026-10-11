# BusinessOS — launch and pitch checks

- [ ] Open on Vercel **Preview**, not production. Verify full Next build is green and route count is 80.
- [ ] Platform branding: rename from System Owner and confirm header, pricing site and install page; logo, favicon and accent colours reflected. Refresh/cached app notes.
- [ ] New user: create Free business, verify eight core capabilities and no paid-only menu links; try direct paid URLs and confirm server checks deny access.
- [ ] System Owner: edit paid plan name, actual monthly/yearly price, module list and allowed staff-role matrix; compare cards in `/pricing` and `/upgrade`.
- [ ] Paystack: with sandbox keys only, verify matching amount/currency/reference, callback + webhook, idempotence, expiry and access. Do not demo checkout when not configured.
- [ ] System Owner manually grant a published plan to a test business with reason; verify audit and entitlement. Confirm private customer orders are not accessible in platform administration.
- [ ] Invite employee via email and fallback invitation link; accept with different account, view own permissions and change role with business-owner consent.
- [ ] Team updates: post as owner and staff; different business must not read or write the message.
- [ ] Create a customer, product, order, part payment and issued invoice. Test invoice layout at A4 and mobile print.
- [ ] Exports: owner downloads all six data categories and opens in Excel. Verify CSV injection safety; staff gets 403; cross-business isolation; count >10,000 fails with no misleading partial CSV.
- [ ] Printable summary uses real record counts; Print → Save as PDF (not a complete PDF of individual transactions).
- [ ] Verify 046–048 migration state and current-month dashboard date fix 045 before demo. No SQL/error IDs exposed to ordinary users.
- [ ] Test mobile Chrome and Safari installation separately; PWA icon and configured product name, iPhone cached app name may require re-add.
- [ ] On slow mobile data, test each route, loading timeout, clear retry and no technical details in customer errors.
