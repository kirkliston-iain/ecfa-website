create table public.fixture_result_overrides (
 fixture_id uuid primary key references public.fixtures(id) on delete cascade,
 actual_home_score integer not null check(actual_home_score>=0),
 actual_away_score integer not null check(actual_away_score>=0),
 winner_team_id uuid not null references public.teams(id),
 updated_at timestamptz not null default now()
);
alter table public.fixture_result_overrides enable row level security;
revoke all on public.fixture_result_overrides from anon, authenticated;
grant select,insert,update,delete on public.fixture_result_overrides to authenticated;
create policy "Administrators manage private result overrides" on public.fixture_result_overrides for all to authenticated
 using ((select auth.uid()) in (select id from public.admin_profiles))
 with check ((select auth.uid()) in (select id from public.admin_profiles));
create trigger admin_audit_trigger after insert or update or delete on public.fixture_result_overrides for each row execute function private.capture_admin_audit();

create function private.enforce_official_fixture_result() returns trigger language plpgsql security invoker set search_path='' as $$
declare o public.fixture_result_overrides;
begin
 select * into o from public.fixture_result_overrides where fixture_id=new.id;
 if found then
  if o.winner_team_id not in (new.home_team_id,new.away_team_id) then raise exception 'Remove result override before changing teams'; end if;
  new.home_score=case when o.winner_team_id=new.home_team_id then 3 else 0 end;
  new.away_score=case when o.winner_team_id=new.away_team_id then 3 else 0 end;
  new.status='played';
  new.went_to_extra_time=false;new.home_extra_time_score=null;new.away_extra_time_score=null;
  new.decided_by_penalties=false;new.home_penalty_score=null;new.away_penalty_score=null;
 end if;
 return new;
end $$;
create trigger enforce_official_fixture_result before update on public.fixtures for each row execute function private.enforce_official_fixture_result();

create function public.set_fixture_result_override(p_fixture_id uuid,p_actual_home_score integer,p_actual_away_score integer,p_winner_team_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.fixtures; stamp timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_profiles where id=auth.uid()) then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_actual_home_score is null or p_actual_away_score is null or p_actual_home_score<0 or p_actual_away_score<0 then raise exception 'Enter both actual match scores';end if;
 select * into f from public.fixtures where id=p_fixture_id for update;
 if not found then raise exception 'Fixture not found';end if;
 if p_expected_updated_at is null or f.updated_at is distinct from p_expected_updated_at then raise exception 'Another administrator changed this fixture. Reload before saving.' using errcode='40001';end if;
 if f.home_team_id is null or f.away_team_id is null then raise exception 'Both teams must be assigned';end if;
 if p_winner_team_id is null then
  delete from public.fixture_result_overrides where fixture_id=f.id;
 else
  if p_winner_team_id not in (f.home_team_id,f.away_team_id) then raise exception 'Choose one of the two teams to receive the win';end if;
  insert into public.fixture_result_overrides(fixture_id,actual_home_score,actual_away_score,winner_team_id)
  values(f.id,p_actual_home_score,p_actual_away_score,p_winner_team_id)
  on conflict(fixture_id) do update set actual_home_score=excluded.actual_home_score,actual_away_score=excluded.actual_away_score,winner_team_id=excluded.winner_team_id,updated_at=now();
 end if;
 update public.fixtures set home_score=p_actual_home_score,away_score=p_actual_away_score,status='played',
 went_to_extra_time=false,home_extra_time_score=null,away_extra_time_score=null,
 decided_by_penalties=false,home_penalty_score=null,away_penalty_score=null
 where id=f.id returning updated_at into stamp;
 return jsonb_build_object('updated_at',stamp,'applied',p_winner_team_id is not null);
end $$;
revoke all on function public.set_fixture_result_override(uuid,integer,integer,uuid,timestamptz) from public,anon;
grant execute on function public.set_fixture_result_override(uuid,integer,integer,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
