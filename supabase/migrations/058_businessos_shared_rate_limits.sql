BEGIN;
CREATE TABLE IF NOT EXISTS public.businessos_rate_limit_buckets(bucket_key text PRIMARY KEY,window_started_at timestamptz NOT NULL,window_ends_at timestamptz NOT NULL,request_count integer NOT NULL CHECK(request_count>=0),CONSTRAINT businessos_rate_limit_bucket_key_format CHECK(bucket_key ~ '^[0-9a-f]{64}$'));
CREATE INDEX IF NOT EXISTS businessos_rate_limit_window_ends_idx ON public.businessos_rate_limit_buckets(window_ends_at);
ALTER TABLE public.businessos_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.businessos_rate_limit_buckets FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.businessos_consume_rate_limit(p_bucket_key text,p_limit integer,p_window_seconds integer)
RETURNS TABLE(allowed boolean,remaining integer,retry_after_seconds integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_now timestamptz:=clock_timestamp();v_count integer;v_ends timestamptz;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF;
 IF p_bucket_key IS NULL OR p_bucket_key !~ '^[0-9a-f]{64}$' OR p_limit IS NULL OR p_limit<1 OR p_limit>10000 OR p_window_seconds IS NULL OR p_window_seconds<1 OR p_window_seconds>86400 THEN RAISE EXCEPTION 'invalid rate limit arguments' USING ERRCODE='22023'; END IF;
 INSERT INTO public.businessos_rate_limit_buckets AS bucket(bucket_key,window_started_at,window_ends_at,request_count) VALUES(p_bucket_key,v_now,v_now+make_interval(secs=>p_window_seconds),1)
 ON CONFLICT(bucket_key) DO UPDATE SET window_started_at=CASE WHEN bucket.window_ends_at<=v_now THEN v_now ELSE bucket.window_started_at END,window_ends_at=CASE WHEN bucket.window_ends_at<=v_now THEN v_now+make_interval(secs=>p_window_seconds) ELSE bucket.window_ends_at END,request_count=CASE WHEN bucket.window_ends_at<=v_now THEN 1 ELSE LEAST(bucket.request_count+1,p_limit+1) END
 RETURNING request_count,window_ends_at INTO v_count,v_ends;
 IF random()<0.01 THEN DELETE FROM public.businessos_rate_limit_buckets WHERE bucket_key IN(SELECT old.bucket_key FROM public.businessos_rate_limit_buckets old WHERE old.window_ends_at<v_now-interval '1 day' ORDER BY old.window_ends_at LIMIT 100); END IF;
 RETURN QUERY SELECT v_count<=p_limit,GREATEST(p_limit-v_count,0),GREATEST(1,CEIL(EXTRACT(EPOCH FROM(v_ends-v_now)))::integer);
END;$$;
REVOKE ALL ON FUNCTION public.businessos_consume_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.businessos_consume_rate_limit(text,integer,integer) TO service_role;
COMMIT;
