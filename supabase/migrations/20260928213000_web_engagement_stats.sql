-- Anonymous, aggregate-only engagement metrics. No IP address or user identity is stored.
create table if not exists public.web_sessions (
  id uuid primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_seconds integer not null default 0 check (active_seconds >= 0)
);

create index if not exists web_sessions_started_at_idx on public.web_sessions (started_at desc);
alter table public.web_sessions enable row level security;
revoke all on public.web_sessions from anon, authenticated;

create table if not exists public.web_interactions (
  id bigint generated always as identity primary key,
  action_kind text not null check (action_kind in ('download', 'view', 'search_result')),
  item_label text not null check (length(item_label) between 1 and 200),
  occurred_at timestamptz not null default now()
);

create index if not exists web_interactions_recent_idx on public.web_interactions (occurred_at desc, action_kind);
alter table public.web_interactions enable row level security;
revoke all on public.web_interactions from anon, authenticated;

create or replace function public.record_web_session(p_session_id uuid, p_active_seconds integer default 0)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_session_id is null or p_active_seconds is null or p_active_seconds < 0 or p_active_seconds > 30 then return; end if;
  insert into public.web_sessions (id, active_seconds) values (p_session_id, p_active_seconds)
  on conflict (id) do update set
    last_seen_at = now(),
    active_seconds = least(public.web_sessions.active_seconds + excluded.active_seconds, 86400);
end;
$$;

create or replace function public.record_web_interaction(p_action text, p_item text)
returns void language plpgsql security definer set search_path = '' as $$
declare clean_item text;
begin
  clean_item := left(trim(coalesce(p_item, '')), 200);
  if p_action not in ('download', 'view', 'search_result') or clean_item = '' then return; end if;
  insert into public.web_interactions (action_kind, item_label) values (p_action, clean_item);
end;
$$;

create or replace function public.get_web_engagement_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'visits_30', (select count(*) from public.web_sessions where started_at >= now() - interval '30 days'),
    'average_seconds_30', (select coalesce(round(avg(active_seconds)), 0) from public.web_sessions where started_at >= now() - interval '30 days'),
    'downloads_30', (select count(*) from public.web_interactions where action_kind = 'download' and occurred_at >= now() - interval '30 days'),
    'views_30', (select count(*) from public.web_interactions where action_kind = 'view' and occurred_at >= now() - interval '30 days'),
    'search_clicks_30', (select count(*) from public.web_interactions where action_kind = 'search_result' and occurred_at >= now() - interval '30 days'),
    'top_interactions', (select coalesce(jsonb_agg(jsonb_build_object('action', action_kind, 'item', item_label, 'count', hits) order by hits desc, item_label), '[]'::jsonb)
      from (select action_kind, item_label, count(*) as hits from public.web_interactions
        where occurred_at >= now() - interval '30 days' group by action_kind, item_label order by hits desc limit 100) ranked)
  );
$$;

revoke all on function public.record_web_session(uuid, integer) from public;
revoke all on function public.record_web_interaction(text, text) from public;
revoke all on function public.get_web_engagement_stats() from public;
grant execute on function public.record_web_session(uuid, integer) to anon, authenticated;
grant execute on function public.record_web_interaction(text, text) to anon, authenticated;
grant execute on function public.get_web_engagement_stats() to anon, authenticated;
