# BusinessOS controlled module trials — applied 2026-10-24

Migration `businessos_selectable_module_trials_with_expiry` has been **applied** to the connected Supabase Business Platform database. Do not rerun the historical SQL.

## How to configure and issue a trial
1. System Owner opens **Usage limits & trials**.
2. For the desired paid plan, saves a preferred trial duration from 1 to 30 days and enables the offer.
3. In **Trial module**, selects a premium module already included in that plan; checks **Offer this module** and saves. Repeat for other eligible modules.
4. Under **Give a business trial access**, enters the business ID from Registered businesses and selects an exact plan/module offer.
5. Issuing grants the business owner only that module for the approved number of days; the grant is independently audited and expires by the existing `business_has_feature` time check.

Important behavior: trials **do not** change the paid subscription, authorize payment, grant a whole plan, or reissue a module trial repeatedly to the same business. Staff access is not automatically widened beyond Owner. Trial and plan functionality are intentionally separate.

Trial configuration does not automatically grant new registrants access. A future explicit opt-in workflow may do so only after signup, anti-abuse measures and policy review.

## Separate seven-item release gates
- **Action-level permissions:** editing works, enforcement is still off until all server/RPC paths are covered and tested.
- **VAT:** existing integrity safeguard only; correction to authoritative POS, invoices and refunds remains open.
- **Numerical quotas:** editing works, enforcement is off until transactional/concurrent writer verification.
- **Paystack:** checkout integration exists; no accepted end-to-end verified test payment yet.
- **Free-plan settings:** 54 dormant preferences cleaned in prior migration with audit.
- **Navigation:** branded loader restored; latency diagnosis still needs Vercel runtime evidence.
- **Privacy:** signup/cookie improvements released; lawyer-approved publication/retention operations remain outstanding.
