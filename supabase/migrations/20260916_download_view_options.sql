alter table public.site_downloads
  alter column storage_path drop not null,
  add column if not exists public_url text,
  add column if not exists allow_view boolean not null default true,
  add column if not exists allow_download boolean not null default true,
  add column if not exists is_system_managed boolean not null default false;

alter table public.site_downloads
  drop constraint if exists site_downloads_has_file_source,
  add constraint site_downloads_has_file_source
    check (storage_path is not null or public_url is not null),
  drop constraint if exists site_downloads_has_public_action,
  add constraint site_downloads_has_public_action
    check (allow_view or allow_download);

insert into public.site_downloads (
  title,
  description,
  file_name,
  public_url,
  mime_type,
  file_size_bytes,
  is_published,
  allow_view,
  allow_download,
  is_system_managed
)
select
  'ECFA Public Website Features Guide',
  'A guide to the fixtures, results, competitions, teams, players, referees, records and other features available to the public.',
  'ECFA-Public-Website-Features-Guide.pdf',
  '/documents/ECFA-Public-Website-Features-Guide.pdf',
  'application/pdf',
  0,
  true,
  true,
  true,
  true
where not exists (
  select 1 from public.site_downloads
  where public_url = '/documents/ECFA-Public-Website-Features-Guide.pdf'
);

create unique index if not exists site_downloads_public_url_key
  on public.site_downloads (public_url)
  where public_url is not null;
