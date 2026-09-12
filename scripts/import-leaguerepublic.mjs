// Imports fixtures, results and goalscorers from LeagueRepublic into Supabase.
//
// Safe to re-run any time during the trial period — everything upserts by
// LeagueRepublic's own IDs, so re-running just refreshes scores/scorers
// rather than creating duplicates.
//
// Usage:
//   npm run import
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (see README).

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — see README.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SEASON_ID = 266691528 // 2026-27 season

// The 3 competitions currently live on LeagueRepublic (Brian Latto Cup isn't
// created there yet — it stays manual in our admin until it exists).
const COMPETITIONS = [
  { slug: 'appin-league', fixtureTypeID: 1, fixtureGroupIdentifier: 575222340 },
  { slug: 'knockout-cup', fixtureTypeID: 2, fixtureGroupIdentifier: 120555442 },
  { slug: 'league-cup', fixtureTypeID: 2, fixtureGroupIdentifier: 545182323 },
]

async function lrFetch(path) {
  const res = await fetch(`https://api.leaguerepublic.com/json/${path}.json`)
  if (!res.ok) throw new Error(`LeagueRepublic API error for ${path}: ${res.status}`)
  return res.json()
}

async function upsertTeams(lrTeams) {
  const rows = lrTeams.map((t) => ({
    name: t.teamName,
    leaguerepublic_team_id: t.teamID,
  }))
  const { data, error } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'leaguerepublic_team_id' })
    .select('id, leaguerepublic_team_id')
  if (error) throw error

  // Fetch full map (upsert above may not return untouched existing rows on some PG versions)
  const { data: allTeams } = await supabase.from('teams').select('id, leaguerepublic_team_id')
  const map = new Map()
  for (const t of allTeams) map.set(t.leaguerepublic_team_id, t.id)
  return map
}

async function assignGroupTeams(stage, teamMap) {
  if (stage.stage_type !== 'group') return

  const standings = await lrFetch(
    `getStandingsForFixtureGroup/${stage._fixtureTypeID}/${stage._fixtureGroupIdentifier}`
  )

  for (const groupBlock of standings) {
    // standingsDesc looks like "1-1 Group A" — strip the leading "N-M " prefix
    const groupName = groupBlock.standingsDesc.replace(/^\d+-\d+\s*/, '').trim()
    const dbGroups = stage.groups || []
    const matchedGroup =
      dbGroups.length === 1 ? dbGroups[0] : dbGroups.find((g) => g.name === groupName)
    if (!matchedGroup) {
      console.warn(`  ! No matching DB group for "${groupName}" in stage "${stage.name}" — skipping`)
      continue
    }

    for (const line of groupBlock.standingsLines) {
      const teamId = teamMap.get(line.teamID)
      if (!teamId) continue
      await supabase
        .from('stage_teams')
        .upsert(
          { stage_id: stage.id, group_id: matchedGroup.id, team_id: teamId },
          { onConflict: 'stage_id,team_id' }
        )
    }
  }
}

async function importFixtures(competitionSlug, stages, teamMap) {
  const comp = COMPETITIONS.find((c) => c.slug === competitionSlug)
  const lrFixtures = await lrFetch(
    `getFixturesForFixtureGroup/${comp.fixtureTypeID}/${comp.fixtureGroupIdentifier}`
  )

  const singleStage = stages.length === 1 ? stages[0] : null
  const groupStage = stages.find((s) => s.stage_type === 'group')
  const knockoutStage = stages.find((s) => s.stage_type === 'knockout')

  // Cache which group each team belongs to, for competitions with a group stage
  let teamGroupMap = new Map()
  if (groupStage) {
    const { data: stageTeams } = await supabase
      .from('stage_teams')
      .select('team_id, group_id')
      .eq('stage_id', groupStage.id)
    for (const st of stageTeams) teamGroupMap.set(st.team_id, st.group_id)
  }

  let played = 0
  let upserted = 0

  for (const f of lrFixtures) {
    const homeTeamId = teamMap.get(f.homeTeam)
    const awayTeamId = teamMap.get(f.roadTeam)
    if (!homeTeamId || !awayTeamId) continue

    let targetStage = singleStage
    let groupId = null
    let roundName = f.roundDesc || null

    if (!targetStage) {
      // Multi-stage competition (e.g. League Cup): classify by round description.
      // Knockout rounds mention QF/SF/Final; everything else is the group stage.
      const isKnockout = roundName && /quarter|semi|final|qf|sf/i.test(roundName)
      if (isKnockout && knockoutStage) {
        targetStage = knockoutStage
      } else if (groupStage) {
        targetStage = groupStage
        groupId = teamGroupMap.get(homeTeamId) || null
      }
    }
    if (!targetStage) continue

    const hasResult = f.result === true || f.result === 'true'
    const row = {
      leaguerepublic_fixture_id: f.fixtureID,
      stage_id: targetStage.id,
      group_id: groupId,
      round_name: roundName,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      fixture_date: parseLrDate(f.fixtureDate),
      venue: f.venueAndSubVenueDesc || null,
      home_score: hasResult ? Number(f.homeScore) : null,
      away_score: hasResult ? Number(f.roadScore) : null,
      status: hasResult ? 'played' : 'scheduled',
    }

    const { error } = await supabase
      .from('fixtures')
      .upsert(row, { onConflict: 'leaguerepublic_fixture_id' })
    if (error) {
      console.warn(`  ! Failed to upsert fixture ${f.fixtureID}: ${error.message}`)
      continue
    }
    upserted += 1
    if (hasResult) played += 1
  }

  console.log(`  Fixtures: ${upserted} upserted (${played} played)`)
}

function parseLrDate(lrDate) {
  // LeagueRepublic format: "20260912 09:15"
  if (!lrDate) return null
  const [datePart, timePart] = lrDate.split(' ')
  const y = datePart.slice(0, 4)
  const m = datePart.slice(4, 6)
  const d = datePart.slice(6, 8)
  return `${y}-${m}-${d}T${timePart || '00:00'}:00`
}

async function importScorers(competitionSlug) {
  const { data: comp } = await supabase
    .from('competitions')
    .select('id')
    .eq('slug', competitionSlug)
    .single()

  const { data: stages } = await supabase
    .from('stages')
    .select('id')
    .eq('competition_id', comp.id)

  const stageIds = stages.map((s) => s.id)

  const { data: playedFixtures } = await supabase
    .from('fixtures')
    .select('id, leaguerepublic_fixture_id, home_team_id, away_team_id')
    .in('stage_id', stageIds)
    .eq('status', 'played')

  let scorersImported = 0

  for (const fixture of playedFixtures) {
    const details = await lrFetch(`getFullFixtureDetails/${fixture.leaguerepublic_fixture_id}`)

    const sides = [
      { statTypes: details.homeLeagueStatTypes, teamId: fixture.home_team_id },
      { statTypes: details.roadLeagueStatTypes, teamId: fixture.away_team_id },
    ]

    for (const side of sides) {
      if (!side.statTypes) continue
      const goalsType = side.statTypes.find((st) => st.leagueStatTypeName === 'Goals')
      if (!goalsType) continue

      for (const stat of goalsType.statistics) {
        const firstName = stat.firstName.trim()
        const lastName = stat.lastName.trim()

        let { data: player } = await supabase
          .from('players')
          .select('id')
          .eq('first_name', firstName)
          .eq('last_name', lastName)
          .maybeSingle()

        if (!player) {
          const { data: created, error: createErr } = await supabase
            .from('players')
            .insert({ first_name: firstName, last_name: lastName })
            .select('id')
            .single()
          if (createErr) continue
          player = created
        }

        await supabase.from('fixture_scorers').upsert(
          {
            fixture_id: fixture.id,
            player_id: player.id,
            team_id: side.teamId,
            goals: Number(stat.statisticValue),
          },
          { onConflict: 'fixture_id,player_id' }
        )
        scorersImported += 1
      }
    }
  }

  console.log(`  Scorers: ${scorersImported} entries upserted`)
}

async function main() {
  for (const comp of COMPETITIONS) {
    console.log(`\n=== ${comp.slug} ===`)

    const { data: dbComp, error: compErr } = await supabase
      .from('competitions')
      .select('id')
      .eq('slug', comp.slug)
      .single()
    if (compErr || !dbComp) {
      console.warn(`  ! Competition "${comp.slug}" not found in database — skipping`)
      continue
    }

    const { data: stages } = await supabase
      .from('stages')
      .select('id, name, stage_type, groups(id, name)')
      .eq('competition_id', dbComp.id)
      .order('sort_order')

    for (const s of stages) {
      s._fixtureTypeID = comp.fixtureTypeID
      s._fixtureGroupIdentifier = comp.fixtureGroupIdentifier
    }

    console.log('  Fetching teams…')
    const lrTeams = await lrFetch(`getTeamsForFixtureGroup/${comp.fixtureTypeID}/${comp.fixtureGroupIdentifier}`)
    const teamMap = await upsertTeams(lrTeams)
    console.log(`  Teams: ${lrTeams.length} upserted`)

    for (const stage of stages) {
      await assignGroupTeams(stage, teamMap)
    }

    await importFixtures(comp.slug, stages, teamMap)
    await importScorers(comp.slug)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
