-- Consolidate confirmed duplicate current squad records. Keep one stable
-- canonical record for each player and preserve all linked match data.

-- Lloyde O'Donnell's later duplicate includes a copy of the same yellow card,
-- so remove that duplicate card before merging the player record.
delete from public.discipline_records
where id = '36ee5ed4-0fb8-4fab-90d1-8b9873aedc99';

update public.fixture_scorers set player_id = '399ca243-4167-484c-aa39-28339f783be5'
where player_id = 'a6c7beb3-0c70-438c-ae3e-f70dcc68816b';
update public.discipline_records set player_id = '399ca243-4167-484c-aa39-28339f783be5'
where player_id = 'a6c7beb3-0c70-438c-ae3e-f70dcc68816b';
update public.suspensions set player_id = '399ca243-4167-484c-aa39-28339f783be5'
where player_id = 'a6c7beb3-0c70-438c-ae3e-f70dcc68816b';
update public.point_adjustments set player_id = '399ca243-4167-484c-aa39-28339f783be5'
where player_id = 'a6c7beb3-0c70-438c-ae3e-f70dcc68816b';

delete from public.players where id in (
  'ab444d6c-28f7-4064-ace3-aecc25dc9d72', -- Craig Mitchell
  '85fac687-f106-43ad-b9d4-5d8591aac995', -- Aaron Cook
  'a6c7beb3-0c70-438c-ae3e-f70dcc68816b', -- Lloyde O'Donnell
  '33d26a16-2343-4355-81ea-02c0a7c6ae66'  -- Ryan Collins
);

-- Apply the confirmed canonical spelling to season totals and match detail.
update public.historic_scorers
set player_name = case lower(player_name)
  when 'kev kendrick' then 'Kevin Kendrick'
  when 'aaran fraser' then 'Aaron Fraser'
  when 'matthew tulloch' then 'Matt Tulloch'
  when 'steven ferguson' then 'Stephen Ferguson'
  when 'ian mackin' then 'Iain Mackin'
  when 'stef diresta' then 'Stefan Diresta'
  when 'steven burns' then 'Stephen Burns'
  when 'dave guthrie' then 'David Guthrie'
  when 'sean brown' then 'Shaun Brown'
  when 'lloyd o''donnell' then 'Lloyde O''Donnell'
  when 'calum jackson' then 'Callum Jackson'
  when 'ewan lowrie' then 'Ewen Lowrie'
  when 'pete coackley' then 'Peter Coackley'
  when 'steve king' then 'Steven King'
  when 'cammy mitchell' then 'Cameron Mitchell'
  else player_name
end
where lower(player_name) in (
  'kev kendrick', 'aaran fraser', 'matthew tulloch', 'steven ferguson',
  'ian mackin', 'stef diresta', 'steven burns', 'dave guthrie',
  'sean brown', 'lloyd o''donnell', 'calum jackson', 'ewan lowrie',
  'pete coackley', 'steve king', 'cammy mitchell'
);

update public.historic_match_scorers
set player_name = case lower(player_name)
  when 'kev kendrick' then 'Kevin Kendrick'
  when 'aaran fraser' then 'Aaron Fraser'
  when 'matthew tulloch' then 'Matt Tulloch'
  when 'steven ferguson' then 'Stephen Ferguson'
  when 'ian mackin' then 'Iain Mackin'
  when 'stef diresta' then 'Stefan Diresta'
  when 'steven burns' then 'Stephen Burns'
  when 'dave guthrie' then 'David Guthrie'
  when 'sean brown' then 'Shaun Brown'
  when 'lloyd o''donnell' then 'Lloyde O''Donnell'
  when 'calum jackson' then 'Callum Jackson'
  when 'ewan lowrie' then 'Ewen Lowrie'
  when 'pete coackley' then 'Peter Coackley'
  when 'steve king' then 'Steven King'
  when 'cammy mitchell' then 'Cameron Mitchell'
  else player_name
end
where lower(player_name) in (
  'kev kendrick', 'aaran fraser', 'matthew tulloch', 'steven ferguson',
  'ian mackin', 'stef diresta', 'steven burns', 'dave guthrie',
  'sean brown', 'lloyd o''donnell', 'calum jackson', 'ewan lowrie',
  'pete coackley', 'steve king', 'cammy mitchell'
);
