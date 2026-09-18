alter table public.contact_enquiries
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint;

alter table public.contact_enquiries
  drop constraint if exists contact_enquiries_attachment_size_check;
alter table public.contact_enquiries
  add constraint contact_enquiries_attachment_size_check
  check (attachment_size_bytes is null or (attachment_size_bytes > 0 and attachment_size_bytes <= 10485760));

alter table public.contact_enquiries
  drop constraint if exists contact_enquiries_enquiry_type_check;
alter table public.contact_enquiries
  add constraint contact_enquiries_enquiry_type_check
  check (enquiry_type in (
    'General Query',
    'Sponsorship Enquiry',
    'Charity',
    'Website Error',
    'Feature Request',
    'League Application'
  ));

alter table public.contact_enquiries
  drop constraint if exists contact_method_required;
alter table public.contact_enquiries
  add constraint contact_method_required
  check (
    enquiry_type in ('Website Error', 'Feature Request')
    or nullif(btrim(coalesce(email, '')), '') is not null
    or nullif(btrim(coalesce(mobile, '')), '') is not null
  );

drop policy if exists "Public can submit contact enquiries" on public.contact_enquiries;
create policy "Public can submit contact enquiries"
on public.contact_enquiries for insert
to anon, authenticated
with check (
  enquiry_type in (
    'General Query', 'Sponsorship Enquiry', 'Charity',
    'Website Error', 'Feature Request', 'League Application'
  )
  and char_length(btrim(name)) between 2 and 120
  and char_length(btrim(message)) between 5 and 5000
  and (
    enquiry_type in ('Website Error', 'Feature Request')
    or nullif(btrim(coalesce(email, '')), '') is not null
    or nullif(btrim(coalesce(mobile, '')), '') is not null
  )
  and (attachment_path is null or attachment_path like 'enquiries/%')
);

drop policy if exists "Admins can view contact enquiries" on public.contact_enquiries;
create policy "Admins can view contact enquiries"
on public.contact_enquiries for select
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));

drop policy if exists "Admins can update contact enquiry status" on public.contact_enquiries;
create policy "Admins can update contact enquiry status"
on public.contact_enquiries for update
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())))
with check (
  exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
  and status in ('new', 'in_progress', 'closed')
);

drop policy if exists "Admins can delete contact enquiries" on public.contact_enquiries;
create policy "Admins can delete contact enquiries"
on public.contact_enquiries for delete
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-attachments',
  'contact-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "visitors can upload contact attachments" on storage.objects;
create policy "visitors can upload contact attachments"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'contact-attachments'
  and (storage.foldername(name))[1] = 'enquiries'
);

drop policy if exists "admins can view contact attachments" on storage.objects;
create policy "admins can view contact attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'contact-attachments'
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);

drop policy if exists "admins can delete contact attachments" on storage.objects;
create policy "admins can delete contact attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'contact-attachments'
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);
