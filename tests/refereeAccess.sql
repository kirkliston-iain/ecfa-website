-- Run against a configured ECFA database as a database administrator.
-- All issued test codes, sessions and profile edits are rolled back.
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.admin_profiles order by id limit 1), true);
set local role authenticated;
do $$
declare ref uuid; ref_name text; code text; token text; report jsonb;
begin
 select id,name into ref,ref_name from public.referees order by name limit 1;
 if ref is null then raise exception 'At least one referee is required for this test.'; end if;
 code := public.issue_referee_access_code(ref);
 token := public.referee_code_login(code)->>'token';
 perform set_config('request.headers',jsonb_build_object('x-ecfa-referee-session',token)::text,true);
 report := public.referee_private_dashboard();
 if report->>'referee' is distinct from ref_name then raise exception 'Wrong referee returned'; end if;
 if (report->>'games')::int <> jsonb_array_length(report->'matches') then raise exception 'Match total mismatch'; end if;
 if exists(select 1 from jsonb_array_elements(report->'matches') m join public.fixtures f on f.id=(m->>'id')::uuid where f.referee_name is distinct from ref_name) then raise exception 'Another referee matches were exposed'; end if;
 perform public.referee_code_logout();
 begin
  perform public.referee_private_dashboard();
  raise exception 'Logout did not revoke session';
 exception when raise_exception then
  if sqlerrm <> 'Please sign in with your referee code.' then raise; end if;
 end;
 token := public.referee_code_login(code)->>'token';
 perform set_config('request.headers',jsonb_build_object('x-ecfa-referee-session',token)::text,true);
 perform public.issue_referee_access_code(ref);
 begin
  perform public.referee_code_login(code);
  raise exception 'Old code still valid';
 exception when raise_exception then
  if sqlerrm <> 'Invalid login code.' then raise; end if;
 end;
 begin
  perform public.referee_private_dashboard();
  raise exception 'Old session still valid';
 exception when raise_exception then
  if sqlerrm <> 'Please sign in with your referee code.' then raise; end if;
 end;
end $$;
rollback;
begin;
set local role anon;
do $$ begin
 begin
  perform public.referee_private_dashboard(); raise exception 'Anonymous access succeeded';
 exception when raise_exception then
  if sqlerrm <> 'Please sign in with your referee code.' then raise; end if;
 end;
 begin
  perform public.issue_referee_access_code(null); raise exception 'Anonymous code issue succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
select true as referee_access_checks_passed;
