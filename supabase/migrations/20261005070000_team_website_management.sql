alter table public.teams
  add column if not exists team_website_url text,
  add column if not exists team_website_label text;

alter table public.teams
  add constraint teams_website_https_only
  check (team_website_url is null or team_website_url ~* '^https://[^[:space:]]+$');

update public.teams
set team_website_url = 'https://kirkliston-football.vercel.app/',
    team_website_label = 'Kirkliston Community Church FC'
where name in ('Kirkliston Community Church', 'Kirkliston Community Church FC')
  and team_website_url is null;
