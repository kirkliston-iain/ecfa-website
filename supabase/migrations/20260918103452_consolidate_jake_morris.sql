-- Consolidate Jack/Jacob/Jake Morris under the active Carrubbers squad record.
-- The manually-created duplicate contains a copy of the same yellow card, so
-- remove that duplicate rather than counting one booking twice.
delete from public.discipline_records
where id = 'ea6bcaa2-cbbe-47e2-92f7-f7641b211dd3';

update public.fixture_scorers
set player_id = 'ac767d98-450d-42cb-9e04-cd839713103e'
where player_id = 'e4c427f4-85b4-4b06-ae4c-b2aa311834bc';

update public.discipline_records
set player_id = 'ac767d98-450d-42cb-9e04-cd839713103e'
where player_id = 'e4c427f4-85b4-4b06-ae4c-b2aa311834bc';

update public.suspensions
set player_id = 'ac767d98-450d-42cb-9e04-cd839713103e'
where player_id = 'e4c427f4-85b4-4b06-ae4c-b2aa311834bc';

update public.point_adjustments
set player_id = 'ac767d98-450d-42cb-9e04-cd839713103e'
where player_id = 'e4c427f4-85b4-4b06-ae4c-b2aa311834bc';

delete from public.players
where id = 'e4c427f4-85b4-4b06-ae4c-b2aa311834bc';

update public.historic_scorers
set player_name = 'Jake Morris'
where lower(btrim(player_name)) in ('jack morris', 'jacob morris', 'jake morris');

update public.historic_match_scorers
set player_name = 'Jake Morris'
where lower(btrim(player_name)) in ('jack morris', 'jacob morris', 'jake morris');
