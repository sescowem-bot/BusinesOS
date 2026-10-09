-- Phase 03: atomic self-service business registration without a service-role key.
-- Execute AFTER 001, 002 and 003, in a trusted Supabase SQL editor.
create or replace function public.create_my_business_workspace(p_name text,p_category text default 'Other')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_id uuid; v_slug text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 120 then raise exception 'Invalid business name'; end if;
 if not exists (select 1 from public.profiles where id = v_user) then raise exception 'Profile not found'; end if;
 v_slug := 'biz-' || replace(gen_random_uuid()::text,'-','');
 insert into public.businesses (name,slug,category,email) values(trim(p_name),v_slug,left(coalesce(nullif(trim(p_category),''),'Other'),80),(select email from auth.users where id=v_user)) returning id into v_id;
 insert into public.business_members (business_id,user_id,role) values(v_id,v_user,'owner');
 return v_id;
end;$$;
revoke all on function public.create_my_business_workspace(text,text) from public, anon;
grant execute on function public.create_my_business_workspace(text,text) to authenticated;
