-- Transfers change current membership without rewriting represented match clubs.
create table public.player_transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  previous_team_id uuid not null references public.teams(id),
  new_team_id uuid not null references public.teams(id),
  transfer_date date not null,
  history_only boolean not null default false,
  recorded_at timestamptz not null default now(),
  constraint transfer_different_clubs check (previous_team_id <> new_team_id)
);
create index player_transfers_player_date_idx on public.player_transfers(player_id, transfer_date desc);
create index player_transfers_previous_club_idx on public.player_transfers(previous_team_id);
create index player_transfers_new_club_idx on public.player_transfers(new_team_id);
alter table public.player_transfers enable row level security;
grant select on public.player_transfers to anon, authenticated;
grant insert, update on public.player_transfers to authenticated;
revoke delete on public.player_transfers from anon, authenticated;
create policy "Public transfer history" on public.player_transfers for select to anon, authenticated using (true);
create policy "Admins record transfers" on public.player_transfers for insert to authenticated
with check (exists(select 1 from public.admin_profiles where id = (select auth.uid())));
-- UPDATE allows the existing admin-only player merge to retain transfer history.
create policy "Admins retain transfer history" on public.player_transfers for update to authenticated
using (exists(select 1 from public.admin_profiles where id = (select auth.uid())))
with check (exists(select 1 from public.admin_profiles where id = (select auth.uid())));
create trigger admin_audit_trigger after insert or update on public.player_transfers
for each row execute function private.capture_admin_audit();

create function public.record_player_transfer(
  p_player_id uuid, p_previous_team_id uuid, p_new_team_id uuid,
  p_transfer_date date, p_history_only boolean default false
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_player public.players%rowtype;
  v_transfer_id uuid;
  v_latest_date date;
begin
  if auth.uid() is null or not exists(select 1 from public.admin_profiles where id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;
  if p_player_id is null or p_previous_team_id is null or p_new_team_id is null or p_transfer_date is null or p_history_only is null then
    raise exception 'Choose a player, previous club, new club and transfer date';
  end if;
  if p_previous_team_id = p_new_team_id then raise exception 'Choose two different clubs'; end if;
  if p_transfer_date > (now() at time zone 'Europe/London')::date then
    raise exception 'The transfer date cannot be in the future';
  end if;
  select * into v_player from public.players where id = p_player_id for update;
  if not found then raise exception 'Player not found'; end if;
  if exists(select 1 from public.player_transfers where player_id = p_player_id
      and previous_team_id = p_previous_team_id and new_team_id = p_new_team_id and transfer_date = p_transfer_date) then
    raise exception 'This transfer has already been recorded';
  end if;
  if not exists(select 1 from public.teams where id = p_previous_team_id)
     or not exists(select 1 from public.teams where id = p_new_team_id) then
    raise exception 'Club not found';
  end if;
  if not p_history_only then
    if v_player.team_id is distinct from p_previous_team_id then
      raise exception 'The player’s current club has changed. Refresh and select the player again';
    end if;
    select max(transfer_date) into v_latest_date from public.player_transfers where player_id = p_player_id;
    if p_transfer_date < v_latest_date then
      raise exception 'Use history-only to record a move before the player’s latest transfer';
    end if;
    update public.players set team_id = p_new_team_id where id = p_player_id;
    if not found then raise exception 'Player could not be moved'; end if;
  end if;
  insert into public.player_transfers(player_id, previous_team_id, new_team_id, transfer_date, history_only)
    values(p_player_id, p_previous_team_id, p_new_team_id, p_transfer_date, p_history_only)
    returning id into v_transfer_id;
  return v_transfer_id;
end;
$$;
revoke all on function public.record_player_transfer(uuid, uuid, uuid, date, boolean) from public, anon;
grant execute on function public.record_player_transfer(uuid, uuid, uuid, date, boolean) to authenticated;

-- Keep transfer history attached when administrators combine duplicate players.
CREATE OR REPLACE FUNCTION public.merge_player_records(p_keep_player_id uuid, p_merge_player_id uuid, p_effective_date date, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_keep_name text;
  v_merge_name text;
  v_reason text := btrim(p_reason);
  v_count integer;
  v_counts jsonb := '{}'::jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.admin_profiles ap where ap.id = v_actor
  ) then
    raise exception 'Administrator access required';
  end if;

  if p_keep_player_id is null or p_merge_player_id is null then
    raise exception 'Choose both player records';
  end if;
  if p_keep_player_id = p_merge_player_id then
    raise exception 'Choose two different player records';
  end if;
  if p_effective_date is null then
    raise exception 'Reference date is required';
  end if;
  if v_reason = '' then
    raise exception 'Reason is required';
  end if;

  select concat_ws(' ', first_name, last_name)
  into v_keep_name
  from public.players
  where id = p_keep_player_id
  for update;

  select concat_ws(' ', first_name, last_name)
  into v_merge_name
  from public.players
  where id = p_merge_player_id
  for update;

  if v_keep_name is null then raise exception 'Retained player record not found'; end if;
  if v_merge_name is null then raise exception 'Player record to merge not found'; end if;

  select coalesce(nullif(btrim(ap.display_name), ''), nullif(btrim(ap.username), ''), 'Administrator')
  into v_actor_name
  from public.admin_profiles ap
  where ap.id = v_actor;

  update public.fixture_scorers keep_row
  set goals = coalesce(keep_row.goals, 0) + coalesce(merge_row.goals, 0)
  from public.fixture_scorers merge_row
  where keep_row.player_id = p_keep_player_id
    and merge_row.player_id = p_merge_player_id
    and keep_row.fixture_id = merge_row.fixture_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('combined_fixture_scorers', v_count);

  delete from public.fixture_scorers merge_row
  where merge_row.player_id = p_merge_player_id
    and exists (
      select 1
      from public.fixture_scorers keep_row
      where keep_row.player_id = p_keep_player_id
        and keep_row.fixture_id = merge_row.fixture_id
    );

  update public.fixture_scorers
  set player_id = p_keep_player_id
  where player_id = p_merge_player_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('moved_fixture_scorers', v_count);

  update public.discipline_records
  set player_id = p_keep_player_id
  where player_id = p_merge_player_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('discipline_records', v_count);

  update public.suspensions
  set player_id = p_keep_player_id
  where player_id = p_merge_player_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('suspensions', v_count);

  update public.point_adjustments
  set player_id = p_keep_player_id
  where player_id = p_merge_player_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('point_adjustments', v_count);

  update public.historic_scorers
  set player_name = v_keep_name
  where lower(btrim(player_name)) = lower(btrim(v_merge_name));
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('historic_scorers', v_count);

  update public.historic_match_scorers
  set player_name = v_keep_name
  where lower(btrim(player_name)) = lower(btrim(v_merge_name));
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('historic_match_scorers', v_count);

  update public.player_discipline_points
  set player_name = v_keep_name
  where lower(btrim(player_name)) = lower(btrim(v_merge_name));
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('historic_discipline_points', v_count);

  update public.player_transfers set player_id = p_keep_player_id where player_id = p_merge_player_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('player_transfers', v_count);

  delete from public.players where id = p_merge_player_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Could not remove duplicate player record'; end if;
  v_counts := v_counts || jsonb_build_object('players_removed', v_count);

  insert into public.record_name_changes (
    entity_type, entity_id, old_name, new_name, effective_date,
    reason, changed_by, changed_by_name, affected_rows
  ) values (
    'player', p_keep_player_id::text, v_merge_name, v_keep_name, p_effective_date,
    'Merged player records: ' || v_reason, v_actor, v_actor_name, v_counts
  );

  return jsonb_build_object(
    'kept_player_id', p_keep_player_id,
    'merged_player_id', p_merge_player_id,
    'kept_name', v_keep_name,
    'merged_name', v_merge_name,
    'effective_date', p_effective_date,
    'affected_rows', v_counts
  );
end;
$function$;
