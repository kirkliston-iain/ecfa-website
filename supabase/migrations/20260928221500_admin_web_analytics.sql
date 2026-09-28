-- Link future page views and actions to an anonymous visit, without storing identity or IP.
alter table public.web_page_views add column if not exists web_session_id uuid;
alter table public.web_interactions add column if not exists web_session_id uuid;
create index if not exists web_page_views_session_idx on public.web_page_views (web_session_id, viewed_at);
create index if not exists web_interactions_session_idx on public.web_interactions (web_session_id, occurred_at);
revoke select on public.web_page_views from anon, authenticated;

create or replace function public.record_page_view(view_path text, p_visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare clean_path text;
begin
  clean_path := split_part(coalesce(view_path, '/'), '?', 1);
  if clean_path = '' then clean_path := '/'; end if;
  if length(clean_path) > 300 then clean_path := left(clean_path, 300); end if;
  if clean_path like '/admin%' or clean_path = '/discipline' then return; end if;
  insert into public.web_page_views(path, web_session_id) values (clean_path, p_visit_id);
end;
$$;

create or replace function public.record_web_interaction(p_action text, p_item text, p_visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare clean_item text;
begin
  clean_item := left(trim(coalesce(p_item, '')), 200);
  if p_action not in ('download', 'view', 'search_result') or clean_item = '' then return; end if;
  insert into public.web_interactions (action_kind, item_label, web_session_id)
  values (p_action, clean_item, p_visit_id);
end;
$$;

-- Overall totals only: available to visitors and signed-in managers.
create or replace function public.get_public_web_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'this_week', count(*) filter (where viewed_at >= ((now() at time zone 'Europe/London')::date - (extract(isodow from now() at time zone 'Europe/London')::int - 1))::timestamp at time zone 'Europe/London'),
    'last_7', count(*) filter (where viewed_at >= now() - interval '7 days'),
    'last_30', count(*) filter (where viewed_at >= now() - interval '30 days'),
    'last_90', count(*) filter (where viewed_at >= now() - interval '90 days'),
    'last_year', count(*) filter (where viewed_at >= now() - interval '1 year'),
    'all_time', count(*) + (select coalesce(max(value), 0) from public.site_stats where key = 'page_views')
  ) from public.web_page_views;
$$;

-- The old detailed functions must not remain available through the public API.
revoke execute on function public.get_web_stats() from public, anon, authenticated;
revoke execute on function public.get_web_engagement_stats() from public, anon, authenticated;

create or replace function public.get_admin_web_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_profiles where id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  return public.get_web_stats();
end;
$$;

create or replace function public.get_admin_web_engagement_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_profiles where id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  return public.get_web_engagement_stats();
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
     (p_action is not null and p_action not in ('download', 'view', 'search_result')) or
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

revoke all on function public.record_page_view(text, uuid) from public;
revoke all on function public.record_web_interaction(text, text, uuid) from public;
revoke all on function public.get_public_web_summary() from public;
revoke all on function public.get_admin_web_stats() from public, anon, authenticated;
revoke all on function public.get_admin_web_engagement_stats() from public, anon, authenticated;
revoke all on function public.get_admin_visit_history(integer, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_page_view(text, uuid) to anon, authenticated;
grant execute on function public.record_web_interaction(text, text, uuid) to anon, authenticated;
grant execute on function public.get_public_web_summary() to anon, authenticated;
grant execute on function public.get_admin_web_stats() to authenticated;
grant execute on function public.get_admin_web_engagement_stats() to authenticated;
grant execute on function public.get_admin_visit_history(integer, text, integer, text, text) to authenticated;
