create table if not exists public.news_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  body text not null default '',
  story_url text,
  event_date date not null,
  graphics jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_content_check check (char_length(btrim(body)) > 0 or nullif(btrim(story_url), '') is not null),
  constraint news_story_url_check check (story_url is null or story_url ~* '^https?://[^[:space:]]+$'),
  constraint news_graphics_check check (jsonb_typeof(graphics) = 'array' and jsonb_array_length(graphics) <= 10),
  constraint news_publish_date_check check (status <> 'published' or published_at is not null)
);

-- The table may have been created before this migration was recorded remotely.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'news_publish_date_check' and conrelid = 'public.news_stories'::regclass) then
    alter table public.news_stories add constraint news_publish_date_check check (status <> 'published' or published_at is not null);
  end if;
end $$;

create index if not exists news_public_order_idx on public.news_stories (published_at desc, id) where status = 'published';
create index if not exists news_admin_order_idx on public.news_stories (created_at desc);

alter table public.news_stories enable row level security;
grant select on public.news_stories to anon, authenticated;
grant insert, update, delete on public.news_stories to authenticated;

drop policy if exists "public can read published news" on public.news_stories;
create policy "public can read published news" on public.news_stories for select
to anon, authenticated using (status = 'published');
drop policy if exists "admins can read all news" on public.news_stories;
create policy "admins can read all news" on public.news_stories for select
to authenticated using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));
drop policy if exists "admins can create news" on public.news_stories;
create policy "admins can create news" on public.news_stories for insert
to authenticated with check (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));
drop policy if exists "admins can update news" on public.news_stories;
create policy "admins can update news" on public.news_stories for update
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())))
with check (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));
drop policy if exists "admins can delete news" on public.news_stories;
create policy "admins can delete news" on public.news_stories for delete
to authenticated using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));

drop trigger if exists news_stories_set_updated_at on public.news_stories;
create trigger news_stories_set_updated_at before update on public.news_stories
for each row execute function private.set_updated_at();
drop trigger if exists admin_audit_trigger on public.news_stories;
create trigger admin_audit_trigger after insert or update or delete on public.news_stories
for each row execute function private.capture_admin_audit();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-graphics', 'news-graphics', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins can upload news graphics" on storage.objects;
create policy "admins can upload news graphics" on storage.objects for insert
to authenticated with check (
  bucket_id = 'news-graphics'
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);
drop policy if exists "admins can delete news graphics" on storage.objects;
create policy "admins can delete news graphics" on storage.objects for delete
to authenticated using (
  bucket_id = 'news-graphics'
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);
