grant update (must_change_password) on public.admin_profiles to authenticated;

drop policy if exists "self complete password setup" on public.admin_profiles;
create policy "self complete password setup"
on public.admin_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
