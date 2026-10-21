begin;
do $$
declare v_id uuid; v_rpc uuid; a uuid; b uuid; c int;
begin
 select id into a from public.teams where name='The Mission';
 select id into b from public.teams where name='South East Saints';
 insert into public.players(first_name,last_name,team_id) values('Squad history','Rollback verification',a) returning id into v_id;
 update public.players set team_id=b where id=v_id;
 update public.players set team_id=null where id=v_id;
 update public.players set team_id=a where id=v_id;
 update public.players set team_id=b where id=v_id;
 select count(*) into c from public.player_transfers where player_id=v_id;
 if c<>3 then raise exception 'Expected 3 retained moves, got %',c; end if;
 select count(*) into c from public.player_squad_history where player_id=v_id;
 if c<>5 then raise exception 'Expected 5 squad events, got %',c; end if;
 if exists(select 1 from public.fixture_scorers where player_id=v_id) then raise exception 'Unexpected statistics'; end if;
 -- Exercise the existing admin RPC and ensure its trigger does not duplicate the transfer.
 perform set_config('request.jwt.claim.sub',(select id::text from public.admin_profiles limit 1),true);
 insert into public.players(first_name,last_name,team_id) values('RPC history','Rollback verification',b) returning id into v_rpc;
 perform public.record_player_transfer(v_rpc,b,a,(now() at time zone 'Europe/London')::date,false);
 select count(*) into c from public.player_transfers where player_id=v_rpc;
 if c<>1 then raise exception 'RPC duplicated transfer: %',c; end if;
 if not exists(select 1 from public.player_squad_history where player_id=v_rpc and previous_team_id=b and new_team_id=a and date_basis='confirmed') then raise exception 'RPC date basis missing'; end if;
end $$;
rollback;