-- Logo records share the site's existing administrator authorization model.
create table public.site_logos (
  id text primary key,
  name text not null,
  category text not null check (category in ('league', 'charity')),
  logo_url text,
  logo_path text,
  updated_at timestamptz not null default now()
);
alter table public.site_logos enable row level security;
grant select on public.site_logos to anon, authenticated;
grant update on public.site_logos to authenticated;
create policy "public read site logos" on public.site_logos for select to anon, authenticated using (true);
create policy "administrators update site logos" on public.site_logos for update to authenticated
using (exists (select 1 from public.admin_profiles where id = (select auth.uid())))
with check (exists (select 1 from public.admin_profiles where id = (select auth.uid())));
create trigger site_logos_set_updated_at before update on public.site_logos
for each row execute function private.set_updated_at();
create trigger admin_audit_trigger after update on public.site_logos
for each row execute function private.capture_admin_audit();

insert into public.site_logos (id, name, category, logo_url) values
('ecfa', 'ECFA website logo', 'league', '/badges/ecfa-embroidered.png'),
('charity-forget-me-notes', 'Forget Me Notes Project', 'charity', '/charities/forget-me-notes-v2.png'),
('charity-dont-screen-us-out', 'Don''t Screen Us Out', 'charity', '/charities/dont-screen-us-out-v2.svg');

alter table public.teams add column logo_path text, add column logo_bucket text;
alter table public.sponsors add column logo_bucket text;
alter table public.sponsors alter column logo_url drop not null;
update public.sponsors set logo_bucket = 'sponsor-logos' where logo_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-logos', 'site-logos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']);
create policy "administrators view managed logos" on storage.objects for select to authenticated
using (bucket_id = 'site-logos' and exists (select 1 from public.admin_profiles where id = (select auth.uid())));
create policy "administrators upload managed logos" on storage.objects for insert to authenticated
with check (bucket_id = 'site-logos' and exists (select 1 from public.admin_profiles where id = (select auth.uid())));
create policy "administrators delete managed logos" on storage.objects for delete to authenticated
using (bucket_id = 'site-logos' and exists (select 1 from public.admin_profiles where id = (select auth.uid())));
