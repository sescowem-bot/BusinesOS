# BusinessOS architecture

## Source of truth
Financial values are derived from orders, order items, payments, expenses and inventory movements. Frontend screens must never accept a client-supplied profit or balance as authoritative.

## Tenant boundary
Every business-owned table carries `business_id`. Access is enforced with Supabase RLS and `is_business_member()` / `is_business_owner()` helpers. A future service layer should perform sensitive mutations in database transactions or server-side functions.

## Money rules
- Order total = subtotal - discount + tax + delivery fee.
- Paid = completed payments only.
- Outstanding = max(0, order total - completed payments).
- COGS = quantity × captured unit cost on order items.
- Estimated profit = sales - COGS - recorded business expenses.
- Margin = estimated profit / sales × 100.
- Cancelled orders are excluded from sales reporting.
- Financial records are never hard-deleted in production; use status/reversal records.

## Web-to-mobile strategy
The Next.js web application is the first client. Supabase remains the shared backend. React Native/Expo can later consume the same database and server-side APIs without changing the business domain model.

## Production integrations to add before public launch
- Supabase production project and migrations
- Server-side Paystack adapter
- WhatsApp Business API adapter
- Email provider adapter
- Push notification service
- Subscription billing
- Object storage with private/public policies
- Error monitoring
- Automated database backups
- CI build/test pipeline
- Domain, analytics and observability
