create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  summary text not null check (char_length(btrim(summary)) between 5 and 600),
  website_url text,
  logo_url text not null,
  logo_path text,
  competition_name text,
  competition_path text,
  sort_order integer not null default 50,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsors_competition_link_check check (competition_path is null or competition_name is not null)
);

create index if not exists sponsors_public_order_idx on public.sponsors (is_published, sort_order, name);

alter table public.sponsors enable row level security;
grant select on public.sponsors to anon, authenticated;
grant insert, update, delete on public.sponsors to authenticated;

create policy "public can view published sponsors" on public.sponsors for select
to anon, authenticated using (is_published = true);
create policy "admins can view all sponsors" on public.sponsors for select
to authenticated using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));
create policy "admins can add sponsors" on public.sponsors for insert
to authenticated with check (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));
create policy "admins can update sponsors" on public.sponsors for update
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())))
with check (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));
create policy "admins can delete sponsors" on public.sponsors for delete
to authenticated using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-logos', 'sponsor-logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy "admins can upload sponsor logos" on storage.objects for insert
to authenticated with check (
  bucket_id='sponsor-logos' and exists (select 1 from public.admin_profiles ap where ap.id=(select auth.uid()))
);
create policy "admins can delete sponsor logos" on storage.objects for delete
to authenticated using (
  bucket_id='sponsor-logos' and exists (select 1 from public.admin_profiles ap where ap.id=(select auth.uid()))
);

insert into public.sponsors (name, summary, website_url, logo_url, competition_name, competition_path, sort_order)
values
('Appin Sports','Edinburgh-based specialists in custom teamwear for football clubs, sports teams and events.','https://appinsports.com/','/sponsors/appin-sports.png','Appin Sports League','/competitions/appin-league',10),
('Kwik Fit','UK vehicle-care specialists providing tyres, MOT testing, servicing, brakes, batteries and exhausts.','https://www.kwik-fit.com/','/sponsors/kwik-fit.png','ECFA League Cup','/competitions/league-cup',90)
on conflict do nothing;

drop trigger if exists sponsors_set_updated_at on public.sponsors;
create trigger sponsors_set_updated_at before update on public.sponsors
for each row execute function private.set_updated_at();

drop trigger if exists admin_audit_trigger on public.sponsors;
create trigger admin_audit_trigger after insert or update or delete on public.sponsors
for each row execute function private.capture_admin_audit();
