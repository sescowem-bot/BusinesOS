\set ON_ERROR_STOP on
CREATE ROLE service_role NOLOGIN;
\i supabase/migrations/058_businessos_shared_rate_limits.sql
DO $$
DECLARE v_allowed boolean;v_remaining integer;v_retry integer;v_key text:=repeat('a',64);
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT allowed,remaining,retry_after_seconds INTO v_allowed,v_remaining,v_retry FROM public.businessos_consume_rate_limit(v_key,2,60);
 IF NOT v_allowed OR v_remaining<>1 THEN RAISE EXCEPTION 'First request should be allowed'; END IF;
 SELECT allowed,remaining,retry_after_seconds INTO v_allowed,v_remaining,v_retry FROM public.businessos_consume_rate_limit(v_key,2,60);
 IF NOT v_allowed OR v_remaining<>0 THEN RAISE EXCEPTION 'Second request should be allowed'; END IF;
 SELECT allowed,remaining,retry_after_seconds INTO v_allowed,v_remaining,v_retry FROM public.businessos_consume_rate_limit(v_key,2,60);
 IF v_allowed OR v_remaining<>0 OR v_retry<1 THEN RAISE EXCEPTION 'Third request should be blocked'; END IF;
 UPDATE public.businessos_rate_limit_buckets SET window_ends_at=clock_timestamp()-interval '1 second' WHERE bucket_key=v_key;
 SELECT allowed,remaining,retry_after_seconds INTO v_allowed,v_remaining,v_retry FROM public.businessos_consume_rate_limit(v_key,2,60);
 IF NOT v_allowed OR v_remaining<>1 THEN RAISE EXCEPTION 'Expired window should reset counter'; END IF;
END $$;
BEGIN;SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM public.businessos_consume_rate_limit(repeat('b',64),2,60);RAISE EXCEPTION 'anon execution allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
ROLLBACK;
DO $$ BEGIN IF has_table_privilege('anon','public.businessos_rate_limit_buckets','SELECT') OR has_table_privilege('authenticated','public.businessos_rate_limit_buckets','SELECT') OR has_table_privilege('service_role','public.businessos_rate_limit_buckets','SELECT') THEN RAISE EXCEPTION 'Direct limiter table access must remain revoked';END IF;END $$;
SELECT 'Phase 0 SQL 058 rate-limit tests passed' AS result;
