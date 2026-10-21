-- Permanent evidence of squad registration, independent of match statistics.
alter table public.player_transfers add column date_basis text not null default 'confirmed'
  check (date_basis in ('confirmed','recorded','audit'));
alter table public.player_transfers add column source_note text;

create table public.player_squad_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  previous_team_id uuid references public.teams(id),
  new_team_id uuid references public.teams(id),
  event_type text not null check (event_type in ('snapshot','added','removed','moved')),
  effective_date date,
  date_basis text not null check (date_basis in ('observed','recorded','audit','confirmed')),
  recorded_at timestamptz not null default now(),
  source_key text unique,
  check (previous_team_id is not null or new_team_id is not null)
);
create index player_squad_history_player_date_idx on public.player_squad_history(player_id, recorded_at desc);
create index player_squad_history_previous_team_idx on public.player_squad_history(previous_team_id);
create index player_squad_history_new_team_idx on public.player_squad_history(new_team_id);
alter table public.player_squad_history enable row level security;
grant select on public.player_squad_history to anon, authenticated;
grant update on public.player_squad_history to authenticated;
create policy "Public squad history" on public.player_squad_history for select to anon, authenticated using (true);
create policy "Admins retain squad history on merge" on public.player_squad_history for update to authenticated
using (exists(select 1 from public.admin_profiles where id=(select auth.uid())))
with check (exists(select 1 from public.admin_profiles where id=(select auth.uid())));

create table public.player_record_aliases (
  previous_player_id uuid primary key,
  player_id uuid not null references public.players(id),
  check (previous_player_id <> player_id)
);
create index player_record_aliases_player_idx on public.player_record_aliases(player_id);
alter table public.player_record_aliases enable row level security;
grant select on public.player_record_aliases to anon, authenticated;
grant insert, update on public.player_record_aliases to authenticated;
create policy "Public retained player links" on public.player_record_aliases for select to anon, authenticated using(true);
create policy "Admins retain player links" on public.player_record_aliases for all to authenticated
using (exists(select 1 from public.admin_profiles where id=(select auth.uid())))
with check (exists(select 1 from public.admin_profiles where id=(select auth.uid())));

-- Baseline is evidence of presence, never an invented joining date.
insert into public.player_squad_history(player_id, new_team_id, event_type, date_basis, recorded_at, source_key)
select p.id, coalesce((a.old_values->>'team_id')::uuid,(a.new_values->>'team_id')::uuid,p.team_id),
 'snapshot','observed',coalesce(a.created_at,now()),'baseline:'||p.id
from public.players p
left join lateral (select * from public.admin_audit_log a where a.table_name='players' and a.record_id=p.id::text
 and (a.old_values->>'team_id' is not null or a.new_values->>'team_id' is not null)
 order by a.created_at,a.id limit 1) a on true
where coalesce(a.old_values->>'team_id',a.new_values->>'team_id',p.team_id::text) is not null;

insert into public.player_squad_history(player_id, previous_team_id,new_team_id,event_type,effective_date,date_basis,recorded_at,source_key)
select p.id,(a.old_values->>'team_id')::uuid,(a.new_values->>'team_id')::uuid,
 case when a.old_values->>'team_id' is null then 'added' when a.new_values->>'team_id' is null then 'removed' else 'moved' end,
 (a.created_at at time zone 'Europe/London')::date,'audit',a.created_at,'audit:'||a.id
from public.admin_audit_log a join public.players p on p.id::text=a.record_id
where a.table_name='players' and a.old_values->>'team_id' is distinct from a.new_values->>'team_id';

-- Direct club changes from any existing editor also produce dated transfers.
insert into public.player_transfers(player_id,previous_team_id,new_team_id,transfer_date,recorded_at,history_only,date_basis,source_note)
select h.player_id,h.previous_team_id,h.new_team_id,h.effective_date,h.recorded_at,true,'audit','Recovered from website squad audit; actual transfer date unconfirmed.'
from public.player_squad_history h where h.event_type='moved'
and not exists(select 1 from public.player_transfers t where t.player_id=h.player_id and t.previous_team_id=h.previous_team_id and t.new_team_id=h.new_team_id and t.transfer_date=h.effective_date);

create function private.capture_squad_membership() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 v_old uuid; v_new uuid; v_player uuid; v_previous uuid;
 v_date date := (now() at time zone 'Europe/London')::date;
 v_basis text := 'recorded';
begin
 if auth.uid() is null and coalesce(current_setting('role',true),'none') not in ('none','postgres','service_role') then
  raise exception 'Authenticated squad editor required';
 end if;
 if tg_op='INSERT' then v_new:=new.team_id; v_player:=new.id;
 elsif tg_op='DELETE' then v_old:=old.team_id; v_player:=old.id;
 else v_old:=old.team_id; v_new:=new.team_id; v_player:=new.id; end if;
 if v_old is not distinct from v_new then return coalesce(new,old); end if;
 -- A merge repoints the existing ledger first and must not add a false departure.
 if tg_op='DELETE' and exists(select 1 from public.player_record_aliases where previous_player_id=v_player) then return old; end if;
 v_previous:=v_old;
 if v_previous is null then
  select previous_team_id into v_previous from public.player_squad_history
  where player_id=v_player and event_type='removed' order by recorded_at desc,id desc limit 1;
 end if;
 if v_previous is not null and v_new is not null and v_previous<>v_new then
  select transfer_date,date_basis into v_date,v_basis from public.player_transfers
  where player_id=v_player and previous_team_id=v_previous and new_team_id=v_new and id=nullif(current_setting('app.recording_transfer_id',true),'')::uuid
  order by recorded_at desc limit 1;
  if not found then
   v_date:=(now() at time zone 'Europe/London')::date; v_basis:='recorded';
   insert into public.player_transfers(player_id,previous_team_id,new_team_id,transfer_date,date_basis,source_note)
   values(v_player,v_previous,v_new,v_date,'recorded','Recorded automatically when the squad list changed; actual transfer date unconfirmed.');
  end if;
 end if;
 insert into public.player_squad_history(player_id,previous_team_id,new_team_id,event_type,effective_date,date_basis)
 values(v_player,v_old,v_new,case when v_old is null then 'added' when v_new is null then 'removed' else 'moved' end,v_date,v_basis);
 return coalesce(new,old);
end;
$$;
revoke all on function private.capture_squad_membership() from public,anon,authenticated;
create trigger capture_squad_membership after insert or update of team_id or delete on public.players
for each row execute function private.capture_squad_membership();

create or replace function public.record_player_transfer(
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
    insert into public.player_transfers(player_id, previous_team_id, new_team_id, transfer_date, history_only)
    values(p_player_id, p_previous_team_id, p_new_team_id, p_transfer_date, false) returning id into v_transfer_id;
    perform set_config('app.recording_transfer_id',v_transfer_id::text,true);
    update public.players set team_id = p_new_team_id where id = p_player_id;
    perform set_config('app.recording_transfer_id','',true);
    if not found then raise exception 'Player could not be moved'; end if;
    return v_transfer_id;
  end if;
  insert into public.player_transfers(player_id, previous_team_id, new_team_id, transfer_date, history_only)
    values(p_player_id, p_previous_team_id, p_new_team_id, p_transfer_date, p_history_only)
    returning id into v_transfer_id;
  return v_transfer_id;
end;
$$;

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

  update public.player_squad_history set player_id=p_keep_player_id where player_id=p_merge_player_id;
  insert into public.player_record_aliases(previous_player_id,player_id) values(p_merge_player_id,p_keep_player_id)
    on conflict(previous_player_id) do update set player_id=excluded.player_id;
  update public.player_record_aliases set player_id=p_keep_player_id where player_id=p_merge_player_id;
  -- Preserve links and private details rather than cascading them away.
  update public.historic_player_links set player_id=p_keep_player_id where player_id=p_merge_player_id;
  insert into public.player_private_details(player_id,date_of_birth)
    select p_keep_player_id,date_of_birth from public.player_private_details where player_id=p_merge_player_id
    on conflict(player_id) do nothing;
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
