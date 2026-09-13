import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

// Circle-method round robin. Returns an array of rounds; each round is an
// array of [teamIdA, teamIdB] pairs (A = home for that leg).
function roundRobinRounds(teamIds) {
  let arr = [...teamIds]
  const hasBye = arr.length % 2 !== 0
  if (hasBye) arr.push(null)
  const n = arr.length
  const half = n / 2
  const rounds = []
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < half; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== null && b !== null) {
        pairs.push(r % 2 === 0 ? [a, b] : [b, a])
      }
    }
    rounds.push(pairs)
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }
  return rounds
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function SeasonAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [structure, setStructure] = useState([]) // competitions -> stages -> groups
  const [teams, setTeams] = useState([])
  const [currentSeason, setCurrentSeason] = useState('')

  // Archive
  const [newSeason, setNewSeason] = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState('')

  // League / group generator
  const [genStageId, setGenStageId] = useState('')
  const [genGroupId, setGenGroupId] = useState('')
  const [genDates, setGenDates] = useState([])
  const [genDateInput, setGenDateInput] = useState('')
  const [genTeamCount, setGenTeamCount] = useState(null)
  const [genDoubleRound, setGenDoubleRound] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')

  // Group draw
  const [drawStageId, setDrawStageId] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [drawMsg, setDrawMsg] = useState('')

  // Knockout round
  const [koStageId, setKoStageId] = useState('')
  const [koRoundName, setKoRoundName] = useState('')
  const [koSelectedTeams, setKoSelectedTeams] = useState([])
  const [koDate, setKoDate] = useState('')
  const [koPairs, setKoPairs] = useState(null) // [[teamId, teamId|null], ...]
  const [koCreating, setKoCreating] = useState(false)
  const [koMsg, setKoMsg] = useState('')

  useEffect(() => {
    supabase
      .from('admin_profiles')
      .select('id')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))

    supabase
      .from('teams')
      .select('id, name')
      .order('name')
      .then(({ data }) => setTeams(data || []))

    loadStructure()

    supabase
      .from('competitions')
      .select('season')
      .limit(1)
      .then(({ data }) => setCurrentSeason(data?.[0]?.season || ''))
  }, [])

  async function loadStructure() {
    const { data: stages } = await supabase
      .from('stages')
      .select('id, name, stage_type, sort_order, competition:competition_id(id, name, sort_order), groups(id, name, sort_order)')
      .order('sort_order')
    const sorted = (stages || []).sort(
      (a, b) => (a.competition?.sort_order ?? 0) - (b.competition?.sort_order ?? 0) || a.sort_order - b.sort_order
    )
    setStructure(sorted)
  }

  // ---- Archive ----
  async function runArchive() {
    if (archiveConfirm !== currentSeason || !newSeason.trim()) return
    setArchiving(true)
    setArchiveMsg('')
    const { error } = await supabase.rpc('archive_and_reset_season', {
      p_old_season: currentSeason,
      p_new_season: newSeason.trim(),
    })
    setArchiving(false)
    if (error) {
      setArchiveMsg('Something went wrong: ' + error.message)
    } else {
      setArchiveMsg(`Archived ${currentSeason} and started ${newSeason.trim()}.`)
      setCurrentSeason(newSeason.trim())
      setNewSeason('')
      setArchiveConfirm('')
    }
  }

  // ---- League / group fixture generator ----
  const genStage = structure.find((s) => s.id === genStageId)
  const genGroups = genStage?.groups || []
  const genGroupIdResolved = genGroupId || (genGroups.length === 1 ? genGroups[0].id : '')

  useEffect(() => {
    setGenTeamCount(null)
    setGenDates([])
    if (!genStageId || !genGroupIdResolved) return
    supabase
      .from('stage_teams')
      .select('team_id', { count: 'exact' })
      .eq('stage_id', genStageId)
      .eq('group_id', genGroupIdResolved)
      .then(({ data }) => setGenTeamCount((data || []).length))
  }, [genStageId, genGroupIdResolved])

  const genRoundsNeeded =
    genTeamCount && genTeamCount >= 2
      ? (genTeamCount % 2 === 0 ? genTeamCount - 1 : genTeamCount) * (genDoubleRound ? 2 : 1)
      : null

  function addGenDate() {
    if (!genDateInput) return
    setGenDates((prev) => (prev.includes(genDateInput) ? prev : [...prev, genDateInput].sort()))
    setGenDateInput('')
  }
  function removeGenDate(d) {
    setGenDates((prev) => prev.filter((x) => x !== d))
  }

  async function generateFixtures() {
    if (!genStageId || !genGroupIdResolved || genDates.length === 0) return
    setGenerating(true)
    setGenMsg('')

    const { data: stageTeams } = await supabase
      .from('stage_teams')
      .select('team_id')
      .eq('stage_id', genStageId)
      .eq('group_id', genGroupIdResolved)

    const teamIds = (stageTeams || []).map((r) => r.team_id)
    if (teamIds.length < 2) {
      setGenMsg('This group needs at least 2 teams assigned before fixtures can be generated.')
      setGenerating(false)
      return
    }

    const firstLeg = roundRobinRounds(teamIds)
    const rounds = genDoubleRound
      ? [...firstLeg, ...firstLeg.map((round) => round.map(([h, a]) => [a, h]))]
      : firstLeg

    if (genDates.length < rounds.length) {
      setGenMsg(`This needs ${rounds.length} match dates for ${teamIds.length} teams — you've added ${genDates.length}. Add ${rounds.length - genDates.length} more.`)
      setGenerating(false)
      return
    }

    const rows = []
    rounds.forEach((round, i) => {
      round.forEach(([homeId, awayId]) => {
        rows.push({
          stage_id: genStageId,
          group_id: genGroupIdResolved,
          home_team_id: homeId,
          away_team_id: awayId,
          fixture_date: genDates[i],
          status: 'scheduled',
        })
      })
    })

    const { error } = await supabase.from('fixtures').insert(rows)
    setGenerating(false)
    setGenMsg(
      error
        ? 'Something went wrong: ' + error.message
        : `Created ${rows.length} fixtures across ${rounds.length} match days.${
            genDates.length > rounds.length ? ` ${genDates.length - rounds.length} extra date(s) you added weren't needed.` : ''
          }`
    )
  }

  // ---- Group draw ----
  async function drawGroups() {
    if (!drawStageId) return
    setDrawing(true)
    setDrawMsg('')

    const stage = structure.find((s) => s.id === drawStageId)
    const groupIds = (stage?.groups || []).map((g) => g.id)
    if (groupIds.length < 2) {
      setDrawMsg('This stage needs at least 2 groups set up first.')
      setDrawing(false)
      return
    }

    const shuffled = shuffle(teams.map((t) => t.id))
    await supabase.from('stage_teams').delete().eq('stage_id', drawStageId)

    const rows = shuffled.map((teamId, i) => ({
      stage_id: drawStageId,
      group_id: groupIds[i % groupIds.length],
      team_id: teamId,
    }))
    const { error } = await supabase.from('stage_teams').insert(rows)
    setDrawing(false)
    setDrawMsg(error ? 'Something went wrong: ' + error.message : `Drew ${teams.length} teams into ${groupIds.length} groups.`)
  }

  // ---- Knockout round ----
  function toggleKoTeam(id) {
    setKoSelectedTeams((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
    setKoPairs(null)
  }

  function drawKoPairs() {
    const shuffled = shuffle(koSelectedTeams)
    const pairs = []
    for (let i = 0; i < shuffled.length; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1] ?? null])
    }
    setKoPairs(pairs)
  }

  async function createKoFixtures() {
    if (!koStageId || !koPairs || !koDate) return
    setKoCreating(true)
    setKoMsg('')
    const rows = koPairs
      .filter(([, away]) => away !== null)
      .map(([home, away]) => ({
        stage_id: koStageId,
        group_id: null,
        home_team_id: home,
        away_team_id: away,
        fixture_date: koDate,
        round_name: koRoundName || null,
        status: 'scheduled',
      }))
    const { error } = await supabase.from('fixtures').insert(rows)
    setKoCreating(false)
    const byes = koPairs.filter(([, away]) => away === null).length
    setKoMsg(
      error
        ? 'Something went wrong: ' + error.message
        : `Created ${rows.length} fixtures.${byes ? ` ${byes} team(s) received a bye — no fixture needed for them this round.` : ''}`
    )
    if (!error) {
      setKoPairs(null)
      setKoSelectedTeams([])
    }
  }

  function teamName(id) {
    return teams.find((t) => t.id === id)?.name || '—'
  }

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: 480 }}>
      <Link to="/admin/dashboard" style={{ fontSize: 13, color: 'var(--brass)', display: 'block', marginBottom: 16 }}>
        &larr; Back to admin
      </Link>
      <h1 style={{ fontSize: 22, color: 'var(--pitch)', marginBottom: 4 }}>Season Management</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
        Current season: <strong>{currentSeason || '—'}</strong>
      </p>

      {!isAdmin && <p style={{ color: 'var(--muted)' }}>Admin access required.</p>}

      {isAdmin && (
        <>
          {/* ARCHIVE */}
          <h2 style={sectionHeaderStyle}>Archive Season &amp; Start New One</h2>
          <div style={{ ...cardStyle, marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Moves every played fixture and its scorers from this season into the site's history,
              then clears the live schedule so you can generate fresh fixtures for the new season.
              This can't be undone, so double-check before confirming.
            </p>
            <p style={{ fontSize: 12, color: '#B3261E', marginBottom: 12 }}>
              Note: this archives matchday results and scorers only. Discipline records tied to
              this season's fixtures will be cleared along with the fixtures themselves — export
              or note anything you need to keep before archiving.
            </p>
            <input
              placeholder="New season (e.g. 2027/28)"
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 8 }}
            />
            <input
              placeholder={`Type "${currentSeason}" to confirm`}
              value={archiveConfirm}
              onChange={(e) => setArchiveConfirm(e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 10 }}
            />
            <button
              onClick={runArchive}
              disabled={archiving || archiveConfirm !== currentSeason || !newSeason.trim()}
              style={{ ...saveButtonStyle, width: '100%' }}
            >
              {archiving ? 'Archiving…' : `Archive ${currentSeason || '…'} & start new season`}
            </button>
            {archiveMsg && <p style={{ fontSize: 13, marginTop: 10 }}>{archiveMsg}</p>}
          </div>

          {/* LEAGUE / GROUP FIXTURE GENERATOR */}
          <h2 style={sectionHeaderStyle}>Generate League / Group Fixtures</h2>
          <div style={{ ...cardStyle, marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Builds a full home-and-away round robin from whichever teams are already assigned to
              the group below. Works for the league table or a single cup group.
            </p>
            <select
              value={genStageId}
              onChange={(e) => {
                setGenStageId(e.target.value)
                setGenGroupId('')
              }}
              style={{ ...fullSelectStyle, marginBottom: 8 }}
            >
              <option value="">Select stage…</option>
              {structure
                .filter((s) => s.stage_type === 'group')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.competition?.name} — {s.name}
                  </option>
                ))}
            </select>
            {genGroups.length > 1 && (
              <select
                value={genGroupId}
                onChange={(e) => setGenGroupId(e.target.value)}
                style={{ ...fullSelectStyle, marginBottom: 8 }}
              >
                <option value="">Select group…</option>
                {genGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10 }}>
              <input type="checkbox" checked={genDoubleRound} onChange={(e) => setGenDoubleRound(e.target.checked)} />
              Home and away (double round robin)
            </label>

            {genRoundsNeeded && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                {genTeamCount} teams assigned — needs {genRoundsNeeded} match dates. You've added {genDates.length}.
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="date"
                value={genDateInput}
                onChange={(e) => setGenDateInput(e.target.value)}
                style={{ ...fullSelectStyle, flex: 1 }}
              />
              <button onClick={addGenDate} style={{ ...outlineButtonStyle, flexShrink: 0 }}>
                Add date
              </button>
            </div>

            {genDates.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6, padding: 8, marginBottom: 10 }}>
                {genDates.map((d, i) => (
                  <div
                    key={d}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      padding: '4px 0',
                    }}
                  >
                    <span>
                      Match day {i + 1}: {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => removeGenDate(d)} style={{ ...outlineButtonStyle, padding: '2px 8px', fontSize: 12 }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={generateFixtures}
              disabled={generating || !genStageId || !genGroupIdResolved || genDates.length === 0}
              style={{ ...saveButtonStyle, width: '100%' }}
            >
              {generating ? 'Generating…' : 'Generate fixtures'}
            </button>
            {genMsg && <p style={{ fontSize: 13, marginTop: 10 }}>{genMsg}</p>}
          </div>

          {/* GROUP DRAW */}
          <h2 style={sectionHeaderStyle}>Draw Cup Groups</h2>
          <div style={{ ...cardStyle, marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Randomly splits all {teams.length} teams evenly across a stage's existing groups (e.g.
              League Cup Group A / B). Run this before generating that stage's fixtures above.
            </p>
            <select
              value={drawStageId}
              onChange={(e) => setDrawStageId(e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 10 }}
            >
              <option value="">Select stage…</option>
              {structure
                .filter((s) => s.stage_type === 'group' && (s.groups || []).length > 1)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.competition?.name} — {s.name} ({s.groups.length} groups)
                  </option>
                ))}
            </select>
            <button onClick={drawGroups} disabled={drawing || !drawStageId} style={{ ...saveButtonStyle, width: '100%' }}>
              {drawing ? 'Drawing…' : 'Randomly draw groups'}
            </button>
            {drawMsg && <p style={{ fontSize: 13, marginTop: 10 }}>{drawMsg}</p>}
          </div>

          {/* KNOCKOUT ROUND */}
          <h2 style={sectionHeaderStyle}>Knockout Draw</h2>
          <div style={{ ...cardStyle, marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Tick who's in this round (all teams for round one, or whichever teams won last round),
              draw random pairings, then create the fixtures. An odd team out gets a bye — no
              fixture is created for them, so just remember they go through automatically.
            </p>
            <select
              value={koStageId}
              onChange={(e) => setKoStageId(e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 8 }}
            >
              <option value="">Select knockout stage…</option>
              {structure
                .filter((s) => s.stage_type === 'knockout')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.competition?.name} — {s.name}
                  </option>
                ))}
            </select>
            <input
              placeholder="Round name (e.g. Quarter Final)"
              value={koRoundName}
              onChange={(e) => setKoRoundName(e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 8 }}
            />

            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
              {teams.map((t) => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
                  <input type="checkbox" checked={koSelectedTeams.includes(t.id)} onChange={() => toggleKoTeam(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>

            <button
              onClick={drawKoPairs}
              disabled={koSelectedTeams.length < 2}
              style={{ ...outlineButtonStyle, width: '100%', marginBottom: 10 }}
            >
              Random draw ({koSelectedTeams.length} teams selected)
            </button>

            {koPairs && (
              <div style={{ marginBottom: 10 }}>
                {koPairs.map((pair, i) => (
                  <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                    {teamName(pair[0])} v {pair[1] ? teamName(pair[1]) : <em>Bye</em>}
                  </div>
                ))}
              </div>
            )}

            <input
              type="date"
              value={koDate}
              onChange={(e) => setKoDate(e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 10 }}
            />
            <button
              onClick={createKoFixtures}
              disabled={koCreating || !koPairs || !koDate || !koStageId}
              style={{ ...saveButtonStyle, width: '100%' }}
            >
              {koCreating ? 'Creating…' : 'Create fixtures for this round'}
            </button>
            {koMsg && <p style={{ fontSize: 13, marginTop: 10 }}>{koMsg}</p>}
          </div>
        </>
      )}
    </div>
  )
}

const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 14,
}
const sectionHeaderStyle = {
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  marginBottom: 12,
}
const fullSelectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 10px',
  border: '1px solid var(--line)',
  fontSize: 14,
  borderRadius: 6,
}
const saveButtonStyle = {
  padding: '10px 14px',
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  fontSize: 14,
  borderRadius: 6,
  cursor: 'pointer',
}
const outlineButtonStyle = {
  padding: '10px 14px',
  background: 'none',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  fontSize: 14,
  borderRadius: 6,
  cursor: 'pointer',
}
