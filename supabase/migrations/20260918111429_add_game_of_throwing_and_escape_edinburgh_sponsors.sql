insert into public.sponsors (
  name,
  summary,
  website_url,
  logo_url,
  sort_order,
  is_published
)
select
  'Game of Throwing Edinburgh',
  'An interactive axe-throwing experience in Edinburgh offering multiple games, expert guidance and group events.',
  'https://www.gameofthrowing.co.uk/game-of-throwing-edinburgh',
  'https://images.squarespace-cdn.com/content/v1/5f96ae852e14f81cac176e94/1603711689533-WS3X3ZOL0P39Z7SS0MN7/Logo_Header.png',
  30,
  true
where not exists (
  select 1 from public.sponsors where lower(name) = lower('Game of Throwing Edinburgh')
);

insert into public.sponsors (
  name,
  summary,
  website_url,
  logo_url,
  sort_order,
  is_published
)
select
  'Escape Edinburgh',
  'Live escape-room experiences in Edinburgh, with themed games for friends, families, parties and team events.',
  'https://www.escape.game/escape-edinburgh',
  'https://images.squarespace-cdn.com/content/v1/5ecf8c7643241f1336b4b4e8/1590767988445-8NK7H35VJD02TDJS6P4D/Escape_Logo%402x.png',
  40,
  true
where not exists (
  select 1 from public.sponsors where lower(name) = lower('Escape Edinburgh')
);
