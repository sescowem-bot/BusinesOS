#!/usr/bin/env node
const fs=require('node:fs');const assert=require('node:assert/strict');
const read=(p)=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/037_pos_cashier_shifts_reconciliation.sql');
const actions=read('app/(dashboard)/pos/shift-actions.ts');
const listing=read('app/(dashboard)/pos/shifts/page.tsx');
const detail=read('app/(dashboard)/pos/shifts/[id]/page.tsx');
const forms=read('app/(dashboard)/pos/shift-forms.tsx');
const nav=read('components/shell.tsx');
const pos=read('app/(dashboard)/pos/page.tsx');
let count=0;
function check(ok,message){assert.ok(ok,message);count++}
for(const table of ['business_pos_cashier_shifts','business_pos_shift_receipts','business_pos_cash_movements']){
 check(sql.includes(`CREATE TABLE public.${table}`),`${table} table absent`);
 check(sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`),`${table} RLS absent`);
}
for(const fn of ['business_open_pos_shift','business_add_pos_cash_movement','business_close_pos_shift','business_review_pos_shift','business_pos_shift_totals','business_pos_cash_exceptions','business_pos_daily_cash_report']){
 check(sql.includes(`FUNCTION public.${fn}`),`${fn} SQL RPC missing`);
 check(actions.includes(fn)||listing.includes(fn)||detail.includes(fn),`${fn} frontend wiring missing`);
}
for(const fn of ['pos_attach_active_shift','pos_attach_checkout_cash','pos_capture_later_cash'])check(sql.includes(`FUNCTION public.${fn}`),`Missing capture function ${fn}`);
check(sql.includes("currency='NGN'"),'NGN currency restriction absent');
check(sql.includes('CREATE UNIQUE INDEX cashier_one_active_shift'),'one open shift per cashier missing');
check(sql.includes('UNIQUE(shift_id,kind,reference)'),'cash movement voucher deduplication missing');
check(sql.includes('payment_id uuid NOT NULL UNIQUE'),'cash receipt unique payment constraint missing');
check(sql.includes('IF v_s.cashier_id=auth.uid()')&&sql.includes("v_role<>'owner'"),'manager self-review guard missing');
check(sql.includes('closed_at=now()')&&sql.includes('variance=p_counted-v_expected'),'atomic close and variance missing');
check(sql.includes("status=CASE WHEN p_approve THEN 'reviewed' ELSE 'flagged' END"),'review/flag states missing');
check(sql.includes("p.method='cash' AND p.status='completed'"),'cash receipt filtering missing');
check(sql.includes("AND p.method='cash' AND p.status='completed'"),'cash exceptions filtering missing');
check(sql.includes("cash_refunds_without_matching_cash_out"),'cash refund exception tracking missing');
check(sql.includes('REVOKE ALL ON public.business_pos_cashier_shifts'),'table mutation revocation missing');
check(sql.includes('REVOKE ALL ON FUNCTION public.business_review_pos_shift'),'function default revoke missing');
check(actions.includes("requireBusinessFeature('pos')"),'server-side subscription guard missing');
check(forms.includes('useActionState')&&forms.includes('required'),'form submission and confirmation missing');
check(listing.includes('formatCash(')&&detail.includes('formatCash(')&&read('lib/cashier-format.ts').includes('minimumFractionDigits:2'),'kobo-accurate cash formatting missing');
check(nav.includes("href:'/pos/shifts'")&&pos.includes('href="/pos/shifts"'),'navigation missing');
check(listing.includes('POS sales')||listing.includes('Unassigned POS sales'),'unassigned sale notice missing');
check(detail.includes('ShiftTotals')&&detail.includes('MovementForm')&&detail.includes('CloseShiftForm'),'shift detail tools missing');
check(read('package.json').includes('check:phase30j'),'package check missing');
console.log(`Phase 030J source integrity checks passed (${count} assertions). SQL execution and RLS behaviour need live staging checks.`);
