-- A historical scorer can have the same spelling as a current player while
-- belonging to a different archived team. Keep the administrator's explicit
-- association by historical name and team rather than guessing from a name.
create table if not exists public.historic_player_links (
  name_key text not null,
  team_key text not null,
  player_id uuid not null references public.players(id) on delete cascade,
  linked_at timestamptz not null default now(),
  linked_by uuid references auth.users(id),
  primary key (name_key, team_key)
);

create index if not exists historic_player_links_player_idx on public.historic_player_links(player_id);
alter table public.historic_player_links enable row level security;
grant select on public.historic_player_links to anon, authenticated;
grant insert, update on public.historic_player_links to authenticated;

create policy "public read historical player links"
  on public.historic_player_links for select to anon, authenticated using (true);
create policy "admins add historical player links"
  on public.historic_player_links for insert to authenticated
  with check (linked_by = (select auth.uid()) and exists (
    select 1 from public.admin_profiles where id = (select auth.uid())
  ));
create policy "admins update historical player links"
  on public.historic_player_links for update to authenticated
  using (exists (select 1 from public.admin_profiles where id = (select auth.uid())))
  with check (linked_by = (select auth.uid()) and exists (
    select 1 from public.admin_profiles where id = (select auth.uid())
  ));

create or replace function public.link_historical_player_to_current(
  p_current_player_id uuid,
  p_historical_name text,
  p_historical_team_name text,
  p_keep_historical_name boolean,
  p_effective_date date,
  p_reason text
) returns jsonb
language plpgsql security invoker set search_path = '' as $function$
declare
  v_actor uuid := (select auth.uid());
  v_current_name text;
  v_final_name text;
  v_old_name text := btrim(p_historical_name);
  v_team text := btrim(p_historical_team_name);
  v_actor_name text;
  v_season_rows integer;
  v_match_rows integer;
begin
  if v_actor is null or not exists (select 1 from public.admin_profiles where id = v_actor) then
    raise exception 'Administrator access required';
  end if;
  if p_current_player_id is null or v_old_name = '' or v_team = '' or p_effective_date is null or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Choose a current player and a historical team, date and reason';
  end if;

  select concat_ws(' ', first_name, last_name) into v_current_name
    from public.players where id = p_current_player_id for update;
  if v_current_name is null then raise exception 'Current player record not found'; end if;
  if not exists (select 1 from public.historic_scorers
      where lower(btrim(player_name)) = lower(v_old_name) and lower(btrim(team_name)) = lower(v_team))
    and not exists (select 1 from public.historic_match_scorers
      where lower(btrim(player_name)) = lower(v_old_name) and lower(btrim(team_name)) = lower(v_team)) then
    raise exception 'The selected historical player and team were not found';
  end if;

  v_final_name := case when p_keep_historical_name then v_old_name else v_current_name end;
  if p_keep_historical_name and lower(v_current_name) <> lower(v_final_name) then
    update public.players set
      first_name = regexp_replace(v_final_name, '\s+\S+$', ''),
      last_name = substring(v_final_name from '\S+$')
    where id = p_current_player_id;
  end if;

  update public.historic_scorers set player_name = v_final_name
    where lower(btrim(player_name)) = lower(v_old_name) and lower(btrim(team_name)) = lower(v_team);
  get diagnostics v_season_rows = row_count;
  update public.historic_match_scorers set player_name = v_final_name
    where lower(btrim(player_name)) = lower(v_old_name) and lower(btrim(team_name)) = lower(v_team);
  get diagnostics v_match_rows = row_count;

  insert into public.historic_player_links(name_key, team_key, player_id, linked_by)
    values (lower(v_final_name), lower(v_team), p_current_player_id, v_actor)
    on conflict (name_key, team_key) do update set
      player_id = excluded.player_id, linked_by = excluded.linked_by, linked_at = now();

  select coalesce(nullif(btrim(display_name), ''), nullif(btrim(username), ''), 'Administrator')
    into v_actor_name from public.admin_profiles where id = v_actor;
  insert into public.record_name_changes
    (entity_type, entity_id, old_name, new_name, effective_date, reason, changed_by, changed_by_name, affected_rows)
    values ('player', p_current_player_id::text, v_old_name, v_final_name, p_effective_date,
      'Linked historical scorer from ' || v_team || ': ' || btrim(p_reason),
      v_actor, v_actor_name,
      jsonb_build_object('historic_scorers', v_season_rows, 'historic_match_scorers', v_match_rows));
  return jsonb_build_object('kept_name', v_final_name, 'merged_name', v_old_name,
    'affected_rows', jsonb_build_object('historic_scorers', v_season_rows, 'historic_match_scorers', v_match_rows));
end;
$function$;

revoke all on function public.link_historical_player_to_current(uuid, text, text, boolean, date, text) from public, anon;
grant execute on function public.link_historical_player_to_current(uuid, text, text, boolean, date, text) to authenticated;
