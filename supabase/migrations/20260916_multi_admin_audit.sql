alter table public.admin_profiles
  add column if not exists username text,
  add column if not exists must_change_password boolean not null default false;

update public.admin_profiles
set display_name = 'Iain McCalman',
    username = coalesce(username, 'iain.mccalman')
where id = '28696bc6-2df2-4855-b259-3f156ad55748';

create unique index if not exists admin_profiles_username_key
  on public.admin_profiles (lower(username))
  where username is not null;

alter table public.fixtures
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text not null,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
grant select on public.admin_audit_log to authenticated;
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

drop policy if exists "Iain can view admin audit log" on public.admin_audit_log;
create policy "Iain can view admin audit log"
on public.admin_audit_log for select
to authenticated
using (
  (select auth.uid()) = '28696bc6-2df2-4855-b259-3f156ad55748'::uuid
  or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists fixtures_set_updated_at on public.fixtures;
create trigger fixtures_set_updated_at before update on public.fixtures
for each row execute function private.set_updated_at();

create or replace function private.capture_admin_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  display text;
  old_row jsonb;
  new_row jsonb;
  rid text;
begin
  if uid is null then return coalesce(new, old); end if;
  select ap.display_name into display from public.admin_profiles ap where ap.id = uid;
  if display is null then return coalesce(new, old); end if;
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  rid := coalesce(new_row->>'id', old_row->>'id', new_row->>'fixture_id', old_row->>'fixture_id');
  insert into public.admin_audit_log(actor_id, actor_name, table_name, action, record_id, old_values, new_values)
  values (uid, display, tg_table_name, tg_op, rid, old_row, new_row);
  return coalesce(new, old);
end;
$$;

revoke all on function private.capture_admin_audit() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'fixtures', 'fixture_scorers', 'discipline_records', 'suspensions', 'players',
    'teams', 'competitions', 'stages', 'groups', 'stage_teams', 'honours',
    'team_points_override', 'calendar_events', 'contact_enquiries', 'referees', 'venues'
  ]
  loop
    execute format('drop trigger if exists admin_audit_trigger on public.%I', table_name);
    execute format(
      'create trigger admin_audit_trigger after insert or update or delete on public.%I for each row execute function private.capture_admin_audit()',
      table_name
    );
  end loop;
end $$;
