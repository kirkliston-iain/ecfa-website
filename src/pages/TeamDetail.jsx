import { PlayerHistoryLink, TeamHistoryLink } from '../components/HistoryLinks'
import { useRememberedState, useRememberedScroll } from '../hooks/usePageMemory'
import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import TeamWebsiteLinks from '../components/TeamWebsiteLinks'
import { displayedScore, outcomeNote } from '../utils/fixtureOutcome'

function Badge({ logoUrl, name, size = 64 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }}
      />
    )
  }
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--ink)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

function resultFor(fixture, teamId) {
  const isHome = fixture.home_team?.id === teamId
  const gf = isHome ? fixture.home_score : fixture.away_score
  const ga = isHome ? fixture.away_score : fixture.home_score
  if (gf == null || ga == null) return null
  if (gf > ga) return 'W'
  if (gf < ga) return 'L'
  return 'D'
}

const RESULT_COLORS = { W: 'var(--win)', D: 'var(--muted)', L: 'var(--red-card)' }

function FormPill({ result, fixtureId }) {
  return (
    <Link
      to={`/fixtures/${fixtureId}`}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: RESULT_COLORS[result] || '#ccc',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {result}
    </Link>
  )
}

function fixtureDay(fixture) {
  return fixture.fixture_date?.slice(0, 10) || ''
}

function wrapCanvasText(ctx, value, maxWidth) {
  const lines = ['']
  for (const word of value.split(' ')) {
    const current = lines.length - 1
    const combined = `${lines[current]} ${word}`.trim()
    if (lines[current] && ctx.measureText(combined).width > maxWidth) lines.push(word)
    else lines[current] = combined
  }
  return lines
}

export default function TeamDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useRememberedState('team', null)
  const [playedFixtures, setPlayedFixtures] = useRememberedState('playedFixtures', [])
  const [upcomingFixtures, setUpcomingFixtures] = useRememberedState('upcomingFixtures', [])
  const [scorers, setScorers] = useRememberedState('scorers', [])
  const [squad, setSquad] = useRememberedState('squad', [])
  const [honours, setHonours] = useRememberedState('honours', [])
  const [loading, setLoading] = useRememberedState('loading', true)
  const [error, setError] = useRememberedState('error', null)
  const [fixtureMonth, setFixtureMonth] = useRememberedState('fixtureMonth', '')
  const [fixtureDate, setFixtureDate] = useRememberedState('fixtureDate', '')
  const [fixtureCompetition, setFixtureCompetition] = useRememberedState('fixtureCompetition', 'appin-league')
  const [sharing, setSharing] = useRememberedState('sharing', false)
  useRememberedScroll(!loading)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: t, error: tErr } = await supabase
        .from('teams')
        .select('id, name, logo_url, manager_name, team_website_url, team_website_label, team_website_links')
        .eq('id', id)
        .single()

      if (tErr || !t) {
        if (!cancelled) {
          setError('Team not found.')
          setLoading(false)
        }
        return
      }

      const { data: fixtures } = await supabase
        .from('fixtures')
        .select(
          'id, round_name, fixture_date, venue, home_score, away_score, went_to_extra_time, home_extra_time_score, away_extra_time_score, decided_by_penalties, home_penalty_score, away_penalty_score, status, stage:stage_id(competition:competition_id(id, slug, name)), home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url)'
        )
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .eq('hidden_from_public', false)
        .order('fixture_date', { ascending: true })

      const played = (fixtures || [])
        .filter((f) => f.status === 'played')
        .sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
      const upcoming = (fixtures || []).filter((f) => f.status !== 'played')

      const { data: scorerRows } = await supabase
        .from('fixture_scorers')
        .select('goals, player:player_id(id, first_name, last_name)')
        .eq('team_id', id)

      const agg = {}
      for (const s of scorerRows || []) {
        const key = s.player?.id || `${s.player?.first_name}-${s.player?.last_name}`
        if (!agg[key]) {
          agg[key] = {
            id: s.player?.id,
            name: `${s.player?.first_name || ''} ${s.player?.last_name || ''}`.trim(),
            goals: 0,
          }
        }
        agg[key].goals += Number(s.goals)
      }
      const scorerList = Object.values(agg).sort((a, b) => b.goals - a.goals)

      const { data: squadRows } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('team_id', id)
        .order('first_name', { ascending: true })
        .order('last_name', { ascending: true })

      const { data: honourRows } = await supabase
        .from('honours')
        .select('season, competition')
        .eq('team_id', id)
        .eq('status', 'winner')
        .order('season', { ascending: true })

      if (!cancelled) {
        setFixtureCompetition('appin-league')
        setFixtureMonth('')
        setFixtureDate('')
        setTeam(t)
        setPlayedFixtures(played)
        setUpcomingFixtures(upcoming)
        setScorers(scorerList)
        setSquad(squadRows || [])
        setHonours(honourRows || [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>
  if (error) return <div className="container" style={{ padding: 48 }}>{error}</div>

  const form = playedFixtures.slice(0, 5)
  const nextFive = upcomingFixtures.slice(0, 5)
  const competitions = [...new Map(upcomingFixtures.map((fixture) => fixture.stage?.competition).filter((competition) => competition?.slug).map((competition) => [competition.slug, competition])).values()]
    .sort((a, b) => a.slug === 'appin-league' ? -1 : b.slug === 'appin-league' ? 1 : a.name.localeCompare(b.name))
  const competitionFixtures = upcomingFixtures.filter((fixture) => fixtureCompetition === 'all' || fixture.stage?.competition?.slug === fixtureCompetition)
  const months = [...new Set(competitionFixtures.map((fixture) => fixtureDay(fixture).slice(0, 7)).filter(Boolean))]
  const filteredFixtures = competitionFixtures.filter((f) =>
    (!fixtureMonth || fixtureDay(f).startsWith(fixtureMonth)) &&
    (!fixtureDate || fixtureDay(f) === fixtureDate)
  )
  const topScorers = scorers.slice(0, 5)

  async function shareFixtures() {
    if (!filteredFixtures.length || sharing) return
    setSharing(true)
    try {
      const canvas = document.createElement('canvas')
      const width = 1080
      const rowHeight = 116
      canvas.width = width
      canvas.height = 240 + filteredFixtures.length * rowHeight + 100
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#141414'
      ctx.fillRect(0, 0, width, 12)
      ctx.fillStyle = '#b8912b'
      ctx.fillRect(0, 12, width, 8)
      ctx.fillStyle = '#141414'
      ctx.font = 'bold 42px Arial, sans-serif'
      const title = wrapCanvasText(ctx, team.name, width - 100).slice(0, 2)
      title.forEach((line, index) => ctx.fillText(line, 50, 72 + index * 47))
      ctx.font = '28px Arial, sans-serif'
      const period = fixtureDate ? new Date(`${fixtureDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : fixtureMonth ? new Date(`${fixtureMonth}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'All upcoming fixtures'
      const label = `${fixtureCompetition === 'all' ? 'All competitions' : competitions.find((competition) => competition.slug === fixtureCompetition)?.name || 'Appin Sports League'} · ${period}`
      ctx.fillStyle = '#6b6b6b'
      ctx.fillText(label, 50, 190)
      filteredFixtures.forEach((f, index) => {
        const y = 240 + index * rowHeight
        ctx.strokeStyle = '#e2e2e2'
        ctx.beginPath()
        ctx.moveTo(50, y - 15)
        ctx.lineTo(width - 50, y - 15)
        ctx.stroke()
        const opponent = f.home_team?.id === team.id ? f.away_team?.name : f.home_team?.name
        const date = fixtureDay(f)
        ctx.fillStyle = '#b8912b'
        ctx.font = 'bold 25px Arial, sans-serif'
        ctx.fillText(date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBC', 50, y + 22)
        ctx.fillStyle = '#141414'
        ctx.font = 'bold 28px Arial, sans-serif'
        wrapCanvasText(ctx, `${f.home_team?.id === team.id ? 'vs' : 'at'} ${opponent || 'TBC'}`, width - 300).slice(0, 2).forEach((line, lineIndex) => ctx.fillText(line, 320, y + 20 + lineIndex * 31))
        ctx.fillStyle = '#6b6b6b'
        ctx.font = '22px Arial, sans-serif'
        const time = f.fixture_date?.includes('T') ? new Date(f.fixture_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
        ctx.fillText([fixtureCompetition === 'all' ? f.stage?.competition?.name : null, time, f.venue].filter(Boolean).join(' · ').slice(0, 75), 320, y + 87)
      })
      ctx.fillStyle = '#6b6b6b'
      ctx.font = '22px Arial, sans-serif'
      ctx.fillText('Edinburgh Churches Football Association · ecfa-website.vercel.app', 50, canvas.height - 35)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Image unavailable')
      const file = new File([blob], `${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-fixtures.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${team.name} fixtures` })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch (err) {
      if (err.name !== 'AbortError') window.alert('Could not create the fixture image. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  const honoursByCompetition = {}
  for (const h of honours) {
    if (!honoursByCompetition[h.competition]) honoursByCompetition[h.competition] = []
    honoursByCompetition[h.competition].push(h.season)
  }
  const competitionOrder = ['League', 'League Cup', 'Knockout Cup', 'Brian Latto Cup']

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          border: 'none',
          background: 'none',
          color: 'var(--brass)',
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 24,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        &larr; Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <Badge logoUrl={team.logo_url} name={team.name} size={64} />
        <div>
          <h1 style={{ fontSize: 26, margin: 0 }}>{team.name}</h1>
          <Link to={`/teams?team=${encodeURIComponent(team.id)}`} style={{ color: 'var(--brass)', display: 'block', marginTop: 6 }}>All seasons, scorers and head-to-head history</Link>
          <TeamWebsiteLinks team={team} context="Team page" />
        </div>
      </div>

      {team.manager_name && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 18,
            paddingLeft: 80,
            fontSize: 14,
          }}
        >
          <span style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11, fontWeight: 700 }}>
            Manager
          </span>
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{team.manager_name}</span>
        </div>
      )}

      {honours.length > 0 && (
        <div
          style={{
            marginBottom: 24,
            padding: '14px 18px',
            background: 'rgba(187, 25, 25, 0.06)',
            border: '1px solid rgba(187, 25, 25, 0.25)',
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--brass)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>
            Honours
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {competitionOrder
              .filter((c) => honoursByCompetition[c])
              .map((c) => (
                <div key={c} style={{ fontSize: 14 }}>
                  <span style={{ fontWeight: 700 }}>{c}</span>
                  <span style={{ color: 'var(--muted)' }}> ({honoursByCompetition[c].length}): {honoursByCompetition[c].map((season, index) => <span key={season}>{index > 0 && ', '}<Link to={`/honours?season=${encodeURIComponent(season)}&team=${encodeURIComponent(team.name)}`}>{season}</Link></span>)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
          Form
        </span>
        {form.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>No results yet.</span>}
        {form
          .slice()
          .reverse()
          .map((f) => (
            <FormPill key={f.id} result={resultFor(f, team.id)} fixtureId={f.id} />
          ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 40,
          marginBottom: 48,
        }}
      >
        <section>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
            Next Fixtures
          </h2>
          {nextFive.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No upcoming fixtures scheduled.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {nextFive.map((f) => {
              const isHome = f.home_team?.id === team.id
              const opponent = isHome ? f.away_team : f.home_team
              return (
                <li key={f.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <Link
                    to={`/fixtures/${f.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 4px',
                      fontSize: 14,
                    }}
                  >
                    <Badge logoUrl={opponent?.logo_url} name={opponent?.name} size={22} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <strong title={isHome ? 'Home' : 'Away'} style={{ color: 'var(--brass)', fontSize: 12 }}>{isHome ? 'H' : 'A'}</strong>
                        <span>{opponent?.name || 'Opponent TBC'}</span>
                      </span>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                        {f.stage?.competition?.name || 'Competition not recorded'}
                      </span>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                        Venue: {f.venue && f.venue.trim().toUpperCase() !== 'N/A' ? f.venue : 'Not recorded'}
                      </span>
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 12, flexShrink: 0, alignSelf: 'center' }}>
                      {f.fixture_date
                        ? new Date(f.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : 'TBC'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
            Top Scorers
          </h2>
          {topScorers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No goals recorded yet.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {topScorers.map((s, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 4px',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 14,
                }}
              >
                <PlayerHistoryLink name={s.name} id={s.id} />
                <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{s.goals}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section id="all-fixtures" style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          All upcoming fixtures
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>Choose a competition, month or date. Share the displayed fixtures as a picture.</p>
        <div className="team-fixture-filters">
          <label>Competition
            <select value={fixtureCompetition} onChange={(event) => { setFixtureCompetition(event.target.value); setFixtureMonth(''); setFixtureDate('') }}>
              <option value="appin-league">Appin Sports League</option>
              {competitions.filter((competition) => competition.slug !== 'appin-league').map((competition) => <option key={competition.slug} value={competition.slug}>{competition.name}</option>)}
              <option value="all">All competitions</option>
            </select>
          </label>
          <label>Month
            <select value={fixtureMonth} onChange={(event) => { setFixtureMonth(event.target.value); setFixtureDate('') }}>
              <option value="">All months</option>
              {months.map((month) => <option key={month} value={month}>{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
            </select>
          </label>
          <label>Date
            <input type="date" value={fixtureDate} onChange={(event) => { const date = event.target.value; setFixtureDate(date); if (date) setFixtureMonth(date.slice(0, 7)) }} />
          </label>
          <button type="button" disabled={!filteredFixtures.length || sharing} onClick={shareFixtures}>{sharing ? 'Preparing…' : 'Share picture'}</button>
        </div>
        {filteredFixtures.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 14 }}>No upcoming fixtures for this selection.</p> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filteredFixtures.map((f) => {
              const isHome = f.home_team?.id === team.id
              const opponent = isHome ? f.away_team : f.home_team
              return <li key={f.id} className="team-fixture-row">
                <Link to={`/fixtures/${f.id}`}>
                  <span className="team-fixture-date">{fixtureDay(f) ? new Date(`${fixtureDay(f)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBC'}</span>
                  <span className="team-fixture-opponent"><strong title={isHome ? 'Home' : 'Away'} style={{ color: 'var(--brass)' }}>{isHome ? 'H' : 'A'}</strong> {opponent?.name || 'Opponent TBC'}</span>
                  <span className="team-fixture-location">{f.stage?.competition?.name || 'Competition not recorded'} · {f.fixture_date?.includes('T') ? `${new Date(f.fixture_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ` : ''}Venue: {f.venue && f.venue.trim().toUpperCase() !== 'N/A' ? f.venue : 'Not recorded'}</span>
                </Link>
              </li>
            })}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          Results
        </h2>
        {playedFixtures.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No results yet.</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {playedFixtures.map((f) => {
            const opponent = f.home_team?.id === team.id ? f.away_team : f.home_team
            const isHome = f.home_team?.id === team.id
            const result = resultFor(f, team.id)
            return (
              <li key={f.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <Link
                  to={`/fixtures/${f.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 4px',
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: RESULT_COLORS[result] || '#ccc',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {result}
                  </span>
                  <Badge logoUrl={opponent?.logo_url} name={opponent?.name} size={20} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <strong title={isHome ? 'Home' : 'Away'} style={{ color: 'var(--brass)', fontSize: 12 }}>{isHome ? 'H' : 'A'}</strong>
                      <span>{opponent?.name || 'Opponent TBC'}</span>
                    </span>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                      Venue: {f.venue && f.venue.trim().toUpperCase() !== 'N/A' ? f.venue : 'Not recorded'}
                    </span>
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--ink)' }}>
                    {displayedScore(f)}
                    {outcomeNote(f) && <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{outcomeNote(f)}</div>}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12, minWidth: 60, textAlign: 'right' }}>
                    {f.fixture_date
                      ? new Date(f.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          Squad
        </h2>
        {squad.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Squad list not yet available.</p>}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '6px 16px',
          }}
        >
          {squad.map((p) => (
            <Link key={p.id} to={`/players/${p.id}`} style={{ fontSize: 14, padding: '4px 0', color: 'var(--ink)' }}>
              {p.first_name} {p.last_name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
