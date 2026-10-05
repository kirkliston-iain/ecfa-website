-- Use the existing public-read/admin-write teams policies for all club links.
alter table public.teams
  add column team_website_links jsonb not null default '[]'::jsonb;

create function public.valid_team_website_links(links jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  link jsonb;
begin
  if links is null or jsonb_typeof(links) <> 'array' then return false; end if;
  if jsonb_array_length(links) > 5 then return false; end if;
  for link in select value from jsonb_array_elements(links) loop
    if jsonb_typeof(link) <> 'object'
      or not coalesce(link->>'type' = any(array['Facebook', 'Instagram', 'X', 'Own Website', 'Other']), false)
      or jsonb_typeof(link->'url') is distinct from 'string'
      or not coalesce(link->>'url' ~ '^https://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$', false)
    then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.teams
  add constraint teams_website_links_valid
  check (public.valid_team_website_links(team_website_links));

-- Preserve existing URLs and their display names, classifying social links.
update public.teams
set team_website_links = jsonb_build_array(jsonb_build_object(
  'type', case
    when team_website_url ~* '^https://([a-z0-9-]+\.)*(facebook\.com|fb\.com)([/:?#]|$)' then 'Facebook'
    when team_website_url ~* '^https://([a-z0-9-]+\.)*instagram\.com([/:?#]|$)' then 'Instagram'
    when team_website_url ~* '^https://([a-z0-9-]+\.)*(x\.com|twitter\.com)([/:?#]|$)' then 'X'
    else 'Own Website'
  end,
  'url', team_website_url
))
where team_website_url is not null;
