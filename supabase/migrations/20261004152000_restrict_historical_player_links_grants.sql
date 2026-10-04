-- Supabase's default public-table grants include write privileges for anon.
-- RLS already blocks those writes; narrow the SQL grants as well.
revoke all on public.historic_player_links from anon, authenticated;
grant select on public.historic_player_links to anon, authenticated;
grant insert, update on public.historic_player_links to authenticated;
