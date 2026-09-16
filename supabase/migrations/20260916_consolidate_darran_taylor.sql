-- Consolidate historical spelling/name variants for the same player.
update public.historic_scorers
set player_name = 'Darran Taylor'
where lower(trim(player_name)) in ('darran taylor', 'darron taylor', 'darron cairns');

update public.historic_match_scorers
set player_name = 'Darran Taylor'
where lower(trim(player_name)) in ('darran taylor', 'darron taylor', 'darron cairns');
