-- Count entries to the public site separately from page views.
-- The browser supplies a random identifier only to make retries idempotent.
create table public.site_arrivals (
  id uuid primary key,
  arrived_at timestamptz not null default now()
);
create index site_arrivals_arrived_at_idx on public.site_arrivals (arrived_at desc);
alter table public.site_arrivals enable row level security;
revoke all on public.site_arrivals from anon, authenticated;

create function public.record_site_arrival(p_arrival_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_arrival_id is null then return; end if;
  insert into public.site_arrivals (id) values (p_arrival_id) on conflict (id) do nothing;
end;
$$;

create or replace function public.get_admin_web_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare arrivals jsonb;
begin
  if not exists (select 1 from public.admin_profiles where id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  select jsonb_build_object(
    'page_views_7', (select count(*) from public.web_page_views where viewed_at >= now() - interval '7 days'),
    'arrivals_today', (select count(*) from public.site_arrivals where (arrived_at at time zone 'Europe/London')::date = (now() at time zone 'Europe/London')::date),
    'arrivals_7', (select count(*) from public.site_arrivals where arrived_at >= now() - interval '7 days'),
    'arrivals_30', (select count(*) from public.site_arrivals where arrived_at >= now() - interval '30 days'),
    'daily_arrivals', (
      select jsonb_agg(jsonb_build_object('date', day::date, 'arrivals', coalesce(counts.total, 0)) order by day desc)
      from generate_series((now() at time zone 'Europe/London')::date - 29,
                           (now() at time zone 'Europe/London')::date, interval '1 day') day
      left join (
        select (arrived_at at time zone 'Europe/London')::date as arrival_date, count(*) as total
        from public.site_arrivals
        where arrived_at >= now() - interval '31 days'
        group by 1
      ) counts on counts.arrival_date = day::date
    )
  ) into arrivals;
  return public.get_web_stats() || arrivals;
end;
$$;

revoke all on function public.record_site_arrival(uuid) from public, anon, authenticated;
grant execute on function public.record_site_arrival(uuid) to anon, authenticated;
revoke all on function public.get_admin_web_stats() from public, anon, authenticated;
grant execute on function public.get_admin_web_stats() to authenticated;
