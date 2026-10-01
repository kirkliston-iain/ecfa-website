-- Include every sponsor in the admin total; the detailed table groups clicks by item label.
create or replace function public.get_admin_web_engagement_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_profiles where id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  return public.get_web_engagement_stats() || jsonb_build_object(
    'sponsor_clicks_30', (select count(*) from public.web_interactions where action_kind = 'sponsor_click' and occurred_at >= now() - interval '30 days'),
    'sponsor_clicks_all_time', (select count(*) from public.web_interactions where action_kind = 'sponsor_click')
  );
end;
$$;

revoke all on function public.get_admin_web_engagement_stats() from public, anon, authenticated;
grant execute on function public.get_admin_web_engagement_stats() to authenticated;
