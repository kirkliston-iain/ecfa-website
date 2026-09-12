# ECFA Website

Website for the Edinburgh Churches Football Association — league table, cups,
fixtures and results, with an admin section for entering results.

## Stack

- React + Vite
- Supabase (Postgres + Auth) for data and admin login
- Vercel for hosting, auto-deploying from this repo's main branch

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase anon key (Supabase
   dashboard → Project Settings → API)
3. `npm run dev`

## Data model

- `competitions` — the 4 ECFA competitions
- `stages` — each competition has 1+ stages (`group` or `knockout`)
- `groups` — for group-type stages with multiple groups (e.g. League Cup Group A/B)
- `teams` — master team list
- `stage_teams` — which teams sit in which stage/group
- `fixtures` — matches, scores, status
- `players` — individual players, matched to LeagueRepublic's `personID` where imported
- `fixture_scorers` — goals per player per fixture (feeds the Top Scorers table via the `competition_top_scorers` view)

Standings are computed on the fly from played fixtures — there's no separate
standings table to keep in sync.

## Importing from LeagueRepublic (trial period)

While running both sites in parallel, pull current fixtures, results and
scorers across from LeagueRepublic with:

```
npm run import
```

This needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (see
`.env.example`) — the service role key is different from the anon key the
app uses, and bypasses row-level security, so it must **never** be committed
or used in the React app. Get it from Supabase dashboard → Project Settings
→ API → service_role key.

Safe to re-run any time — everything upserts by LeagueRepublic's own IDs, so
running it again just refreshes scores and scorers rather than duplicating
anything. Once you're confident in the site and stop using LeagueRepublic,
stop running this and just use `/admin/dashboard` directly.

The Brian Latto Cup isn't set up on LeagueRepublic (it doesn't exist until
the League Cup groups finish), so it stays manual in admin regardless.

## Admin access

Admin users are created manually (no public signup). To add an admin:

1. Supabase dashboard → Authentication → Users → Add user (set email + password)
2. Run this SQL in the SQL editor to grant admin access:
   ```sql
   insert into admin_profiles (id, display_name)
   values ('<the new user's UUID>', 'Iain');
   ```

Admins can then sign in at `/admin` and update scores at `/admin/dashboard`.

## Deploying

Push to `main` — Vercel is already linked to this repo and will build and
deploy automatically.
