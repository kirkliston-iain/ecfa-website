alter table public.fixtures
  add column if not exists assistant_1_name text,
  add column if not exists assistant_2_name text;

alter table public.fixtures add constraint fixtures_distinct_officials check (
  (assistant_1_name is null or referee_name is null or assistant_1_name <> referee_name)
  and (assistant_2_name is null or referee_name is null or assistant_2_name <> referee_name)
  and (assistant_1_name is null or assistant_2_name is null or assistant_1_name <> assistant_2_name)
);
