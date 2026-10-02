-- Record successful Supabase Auth sign-ins without relying on a browser callback.
-- Managers share one account, so its sign-ins cannot identify an individual.
create table if not exists private.sign_in_audit (
  id bigint generated always as identity primary key,
  account_id uuid not null,
  account_kind text not null check (account_kind in ('admin', 'manager')),
  admin_name text,
  signed_in_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (account_id, signed_in_at)
);

create index if not exists sign_in_audit_recent_idx on private.sign_in_audit (signed_in_at desc);
alter table private.sign_in_audit enable row level security;
revoke all on private.sign_in_audit from public, anon, authenticated;

create or replace function private.capture_auth_sign_in()
returns trigger language plpgsql security definer set search_path = '' as $$
declare admin_display text;
begin
  if new.last_sign_in_at is null or new.last_sign_in_at is not distinct from old.last_sign_in_at then
    return new;
  end if;

  select display_name into admin_display from public.admin_profiles where id = new.id;
  if admin_display is not null then
    insert into private.sign_in_audit (account_id, account_kind, admin_name, signed_in_at)
    values (new.id, 'admin', admin_display, new.last_sign_in_at)
    on conflict (account_id, signed_in_at) do nothing;
  elsif lower(new.email) = 'managers@ecfa-website.org' then
    insert into private.sign_in_audit (account_id, account_kind, signed_in_at)
    values (new.id, 'manager', new.last_sign_in_at)
    on conflict (account_id, signed_in_at) do nothing;
  end if;
  return new;
exception when others then
  -- An audit storage error must not lock administrators or managers out.
  raise warning 'Could not record sign-in activity: %', sqlerrm;
  return new;
end;
$$;

revoke all on function private.capture_auth_sign_in() from public, anon, authenticated;
drop trigger if exists ecfa_sign_in_audit on auth.users;
create trigger ecfa_sign_in_audit after update of last_sign_in_at on auth.users
for each row execute function private.capture_auth_sign_in();

create or replace function public.get_admin_sign_in_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_profiles where id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  return jsonb_build_object(
    'admin_30', (select count(*) from private.sign_in_audit where account_kind = 'admin' and signed_in_at >= now() - interval '30 days'),
    'admin_all_time', (select count(*) from private.sign_in_audit where account_kind = 'admin'),
    'manager_30', (select count(*) from private.sign_in_audit where account_kind = 'manager' and signed_in_at >= now() - interval '30 days'),
    'manager_all_time', (select count(*) from private.sign_in_audit where account_kind = 'manager'),
    'manager_last_at', (select last_sign_in_at from auth.users where lower(email) = 'managers@ecfa-website.org' limit 1)
  );
end;
$$;

create or replace function public.get_owner_sign_in_audit()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is distinct from '28696bc6-2df2-4855-b259-3f156ad55748'::uuid
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'owner' then
    raise exception 'Owner access required';
  end if;
  return jsonb_build_object(
    'admin_accounts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.display_name, 'last_at', u.last_sign_in_at,
        'recorded_count', (select count(*) from private.sign_in_audit a where a.account_id = p.id)
      ) order by p.display_name), '[]'::jsonb)
      from public.admin_profiles p join auth.users u on u.id = p.id
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.account_kind, 'name', a.admin_name, 'at', a.signed_in_at
      ) order by a.signed_in_at desc), '[]'::jsonb)
      from (select * from private.sign_in_audit order by signed_in_at desc limit 100) a
    ),
    'manager_last_at', (select last_sign_in_at from auth.users where lower(email) = 'managers@ecfa-website.org' limit 1)
  );
end;
$$;

revoke all on function public.get_admin_sign_in_stats() from public, anon, authenticated;
revoke all on function public.get_owner_sign_in_audit() from public, anon, authenticated;
grant execute on function public.get_admin_sign_in_stats() to authenticated;
grant execute on function public.get_owner_sign_in_audit() to authenticated;
