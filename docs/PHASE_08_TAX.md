# Phase 08 — Nigerian Tax Engine Foundation

## Scope delivered
- Controlled SQL rule catalog: source, effective date, rule status, reviewer, supply assignments, snapshot record schema.
- Tenant-isolated read policies; no self-approval or self-assignment database write access for ordinary business users.
- Protected Tax Centre with mixed-invoice estimator, supply status and legal source links.
- Exact integer-minor-unit VAT estimator for 7.5% standard treatment, zero-rated, exempt and outside-scope.
- Unknown/unapproved supplies remain review-required. VAT does not post to GL or issue invoices.

## Unfinished / mandatory gates
1. Legal counsel/accountant must verify effective law, amendments, detailed exemption and zero-rating schedules and transition measures.
2. Trusted administrative review interface and server-side assignment approval service must be implemented; no rule is seeded as approved.
3. Approved rules must be selected by the transaction date; verify legal rate and jurisdiction on the server; the client preview currently uses 7.5% purely illustratively.
4. Business tax registration, eligibility and statutory exceptions must be established independently. The demo checkbox is not verification.
5. Build server-side transactional invoicing, tax snapshot recording and ledger posting in a later phase.
6. Run migrations 001–009 in order on a nonproduction database and verify RLS by multiple tenant accounts before production.

## Legal references
- National Assembly Nigeria Tax Act: https://nass.gov.ng/documents/download/11249
- Nigeria Tax Act 2025 gazette: https://www.nipc.gov.ng/wp-content/uploads/2025/08/Nigeria-Tax-Act-2025-Gazette.pdf
- Federal transition guidance: https://fmino.gov.ng/federal-government-issues-transition-guidelines-for-tax-acts-2025/
