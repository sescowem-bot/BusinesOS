# Customer paid subscriptions — checkout only

## Customer experience
- Free is always free; no manual approvals or payment required.
- Published paid plans offer monthly or yearly Paystack checkout **only to business owners**.
- A payment is never treated as complete from a return URL alone: the Paystack API is reverified, and an idempotent database function activates only verified matching payments.
- Historical upgrade requests remain in a read-only System Owner archive; new customer request forms and server actions have been removed.
- System Owner can assign plans separately via the existing audited manual action in the Registered businesses area.
- Restricted premium features remain hidden from the normal workspace navigation. The billing page previews selected additional tools; this is not permission to access them.
- If Paystack environment variables are absent, checkout is transparently unavailable. There is **no substitute request-for-upgrade flow**.
- The older Postgres RPC `request_business_upgrade(uuid,text,text)` may still be callable directly by authenticated clients until its EXECUTE grants are removed in a reviewed database change. This GitHub change only removes its app/UI callers.
- Live payment checkout has not been tested until Paystack keys, webhook, and a controlled test payment are verified.

## Production release acceptance
- GitHub CI, typecheck and Next build
- Paystack environment variable presence in Vercel production; never log values
- Controlled test payment confirms provider reference, amount/currency, business ownership, and activation; replay does not duplicate subscription
- Existing free and paid users retain access; manual plan editing remains audited
