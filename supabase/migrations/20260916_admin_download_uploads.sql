create table if not exists public.site_downloads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  is_published boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_downloads_uploaded_by_idx on public.site_downloads (uploaded_by);

alter table public.site_downloads enable row level security;
grant select on public.site_downloads to anon, authenticated;
grant insert, update, delete on public.site_downloads to authenticated;

drop policy if exists "public can view published downloads" on public.site_downloads;
create policy "public can view published downloads"
on public.site_downloads for select
to anon, authenticated
using (is_published = true);

drop policy if exists "admins can view all downloads" on public.site_downloads;
create policy "admins can view all downloads"
on public.site_downloads for select
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));

drop policy if exists "admins can add downloads" on public.site_downloads;
create policy "admins can add downloads"
on public.site_downloads for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);

drop policy if exists "admins can update downloads" on public.site_downloads;
create policy "admins can update downloads"
on public.site_downloads for update
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())))
with check (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));

drop policy if exists "admins can delete downloads" on public.site_downloads;
create policy "admins can delete downloads"
on public.site_downloads for delete
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-downloads',
  'website-downloads',
  true,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/zip',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins can upload website downloads" on storage.objects;
create policy "admins can upload website downloads"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'website-downloads'
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);

drop policy if exists "admins can delete website downloads" on storage.objects;
create policy "admins can delete website downloads"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'website-downloads'
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);

drop trigger if exists site_downloads_set_updated_at on public.site_downloads;
create trigger site_downloads_set_updated_at before update on public.site_downloads
for each row execute function private.set_updated_at();

drop trigger if exists admin_audit_trigger on public.site_downloads;
create trigger admin_audit_trigger after insert or update or delete on public.site_downloads
for each row execute function private.capture_admin_audit();
