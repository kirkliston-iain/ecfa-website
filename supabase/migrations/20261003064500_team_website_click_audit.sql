-- Track outbound team website clicks alongside the existing anonymous visit audit.
alter table public.web_interactions drop constraint if exists web_interactions_action_kind_check;
alter table public.web_interactions add constraint web_interactions_action_kind_check
  check (action_kind in ('download', 'view', 'search_result', 'team_selection', 'sponsor_click', 'team_website_click'));

create or replace function public.record_web_interaction(p_action text, p_item text, p_visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare clean_item text;
begin
  clean_item := left(trim(coalesce(p_item, '')), 200);
  if p_action not in ('download', 'view', 'search_result', 'team_selection', 'sponsor_click', 'team_website_click') or clean_item = '' then return; end if;
  insert into public.web_interactions (action_kind, item_label, web_session_id)
  values (p_action, clean_item, p_visit_id);
end;
$$;

create or replace function public.get_admin_web_engagement_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_profiles where id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  return public.get_web_engagement_stats() || jsonb_build_object(
    'sponsor_clicks_30', (select count(*) from public.web_interactions where action_kind = 'sponsor_click' and occurred_at >= now() - interval '30 days'),
    'sponsor_clicks_all_time', (select count(*) from public.web_interactions where action_kind = 'sponsor_click'),
    'team_website_clicks_30', (select count(*) from public.web_interactions where action_kind = 'team_website_click' and occurred_at >= now() - interval '30 days'),
    'team_website_clicks_all_time', (select count(*) from public.web_interactions where action_kind = 'team_website_click')
  );
end;
$$;

create or replace function public.get_admin_visit_history(p_days integer default 30, p_action text default null, p_offset integer default 0, p_path text default null, p_item text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.admin_profiles where id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  if p_days not in (7, 30, 60, 90, 365) or p_offset < 0 or p_offset > 10000 or
     (p_action is not null and p_action not in ('download', 'view', 'search_result', 'sponsor_click', 'team_website_click')) or
     (p_path is not null and length(p_path) > 300) or
     (p_item is not null and length(p_item) > 200) then
    raise exception 'Invalid filter';
  end if;
  with matching as (
    select s.* from public.web_sessions s
    where s.started_at >= now() - make_interval(days => p_days)
      and (p_action is null and p_item is null or exists (select 1 from public.web_interactions i where i.web_session_id = s.id and (p_action is null or i.action_kind = p_action) and (p_item is null or i.item_label = p_item)))
      and (p_path is null or exists (select 1 from public.web_page_views v where v.web_session_id = s.id and v.path = p_path))
  ), page as (
    select * from matching order by started_at desc limit 50 offset p_offset
  ), details as (
    select p.id, p.started_at, p.last_seen_at, p.active_seconds,
      (select coalesce(jsonb_agg(jsonb_build_object('path', v.path, 'at', v.viewed_at) order by v.viewed_at), '[]'::jsonb)
       from public.web_page_views v where v.web_session_id = p.id) as pages,
      (select coalesce(jsonb_agg(jsonb_build_object('action', i.action_kind, 'item', i.item_label, 'at', i.occurred_at) order by i.occurred_at), '[]'::jsonb)
       from public.web_interactions i where i.web_session_id = p.id) as actions
    from page p
  )
  select jsonb_build_object('total', (select count(*) from matching),
    'visits', coalesce((select jsonb_agg(to_jsonb(d) order by d.started_at desc) from details d), '[]'::jsonb)) into result;
  return result;
end;
$$;

revoke all on function public.record_web_interaction(text, text, uuid) from public;
grant execute on function public.record_web_interaction(text, text, uuid) to anon, authenticated;
revoke all on function public.get_admin_web_engagement_stats() from public, anon, authenticated;
grant execute on function public.get_admin_web_engagement_stats() to authenticated;
revoke all on function public.get_admin_visit_history(integer, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.get_admin_visit_history(integer, text, integer, text, text) to authenticated;
