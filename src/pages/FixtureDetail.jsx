import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { displayedScore, fullOutcomeNote } from '../utils/fixtureOutcome'

function Badge({ logoUrl, name, size = 56 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#fff' }}
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
      }}
    >
      {initials}
    </span>
  )
}

function historicMeetingKey(meeting) {
  return [
    meeting.season,
    meeting.fixture_date?.slice(0, 10),
    meeting.home_team_name,
    meeting.away_team_name,
  ].join('::')
}

export default function FixtureDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [fixture, setFixture] = useState(null)
  const [scorers, setScorers] = useState([])
  const [discipline, setDiscipline] = useState([])
  const [previousMeetings, setPreviousMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: f, error: fErr } = await supabase
        .from('fixtures')
        .select(
          'id, round_name, fixture_date, venue, referee_name, home_score, away_score, went_to_extra_time, home_extra_time_score, away_extra_time_score, decided_by_penalties, home_penalty_score, away_penalty_score, status, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url)'
        )
        .eq('id', id)
        .single()

      if (fErr || !f) {
        if (!cancelled) {
          setError('Fixture not found.')
          setLoading(false)
        }
        return
      }

      const { data: s } = await supabase
        .from('fixture_scorers')
        .select('goals, team_id, player:player_id(first_name, last_name)')
        .eq('fixture_id', id)

      const { data: d } = await supabase
        .from('discipline_records')
        .select('card_type, card_count, team_id, player:player_id(first_name, last_name)')
        .eq('fixture_id', id)

      let meetings = []
      if (f.home_team?.id && f.away_team?.id) {
        const teamPairFilter =
          `and(home_team_id.eq.${f.home_team.id},away_team_id.eq.${f.away_team.id}),` +
          `and(home_team_id.eq.${f.away_team.id},away_team_id.eq.${f.home_team.id})`

        const [{ data: hf }, { data: liveFixtures }] = await Promise.all([
          supabase
            .from('historic_fixtures')
            .select('id, competition_name, season, fixture_date, home_team_name, home_goals, away_team_name, away_goals, comment')
            .or(teamPairFilter)
            .order('fixture_date', { ascending: false })
            .limit(5),
          supabase
            .from('fixtures')
            .select('id, fixture_date, venue, home_score, away_score, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(competition:competition_id(name, season))')
            .or(teamPairFilter)
            .eq('status', 'played')
            .neq('id', id)
            .order('fixture_date', { ascending: false })
            .limit(5),
        ])

        const historicDates = [...new Set((hf || []).map((m) => m.fixture_date?.slice(0, 10)).filter(Boolean))]
        const liveFixtureIds = (liveFixtures || []).map((m) => m.id)
        const [{ data: archivedScorers }, { data: liveScorers }] = await Promise.all([
          historicDates.length
            ? supabase
                .from('historic_match_scorers')
                .select('season, fixture_date, home_team_name, away_team_name, player_name, team_name, goals')
                .in('fixture_date', historicDates)
            : Promise.resolve({ data: [] }),
          liveFixtureIds.length
            ? supabase
                .from('fixture_scorers')
                .select('fixture_id, goals, player:player_id(first_name, last_name), team:team_id(name)')
                .in('fixture_id', liveFixtureIds)
            : Promise.resolve({ data: [] }),
        ])

        const archivedScorersByMatch = {}
        for (const row of archivedScorers || []) {
          const key = historicMeetingKey(row)
          if (!archivedScorersByMatch[key]) archivedScorersByMatch[key] = []
          archivedScorersByMatch[key].push(row)
        }

        const liveScorersByFixture = {}
        for (const row of liveScorers || []) {
          if (!liveScorersByFixture[row.fixture_id]) liveScorersByFixture[row.fixture_id] = []
          liveScorersByFixture[row.fixture_id].push({
            player_name: [row.player?.first_name, row.player?.last_name].filter(Boolean).join(' '),
            team_name: row.team?.name,
            goals: row.goals,
          })
        }

        const historicMeetings = (hf || []).map((m) => ({
          ...m,
          scorers: archivedScorersByMatch[historicMeetingKey(m)] || [],
        }))
        const currentMeetings = (liveFixtures || []).map((m) => ({
          id: `live-${m.id}`,
          competition_name: m.stage?.competition?.name || 'ECFA',
          season: m.stage?.competition?.season || 'Current season',
          fixture_date: m.fixture_date,
          home_team_name: m.home_team?.name,
          home_goals: m.home_score,
          away_team_name: m.away_team?.name,
          away_goals: m.away_score,
          comment: m.venue || null,
          scorers: liveScorersByFixture[m.id] || [],
        }))

        meetings = [...currentMeetings, ...historicMeetings]
          .sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
          .slice(0, 5)
      }

      if (!cancelled) {
        setFixture(f)
        setScorers(s || [])
        setDiscipline(d || [])
        setPreviousMeetings(meetings)
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

  const homeScorers = scorers.filter((s) => s.team_id === fixture.home_team?.id)
  const awayScorers = scorers.filter((s) => s.team_id === fixture.away_team?.id)
  const homeCards = discipline.filter((d) => d.team_id === fixture.home_team?.id)
  const awayCards = discipline.filter((d) => d.team_id === fixture.away_team?.id)
  const played = fixture.status === 'played'

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
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

      {fixture.round_name && (
        <div style={{ fontSize: 13, color: 'var(--brass)', marginBottom: 8, fontWeight: 700 }}>
          {fixture.round_name}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: '28px 0',
          borderBottom: '1px solid var(--line)',
          marginBottom: 24,
        }}
      >
        <Link
          to={`/teams/${fixture.home_team?.id}`}
          style={{ textAlign: 'center', flex: 1, color: 'inherit' }}
        >
          <Badge logoUrl={fixture.home_team?.logo_url} name={fixture.home_team?.name} />
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>{fixture.home_team?.name}</div>
        </Link>

        <div style={{ textAlign: 'center', minWidth: 100 }}>
          {played ? (
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)' }}>
              {displayedScore(fixture)}
            </div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--muted)' }}>vs</div>
          )}
          {played && fullOutcomeNote(fixture) && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, fontWeight: 600 }}>
              {fullOutcomeNote(fixture)}
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            {fixture.fixture_date
              ? new Date(fixture.fixture_date).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }) +
                (fixture.fixture_date.slice(11, 16) !== '00:00'
                  ? `, ${fixture.fixture_date.slice(11, 16)}`
                  : '')
              : 'Date TBC'}
          </div>
          {fixture.venue && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fixture.venue}</div>}
          {fixture.referee_name && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Referee: {fixture.referee_name}</div>
          )}
        </div>

        <Link
          to={`/teams/${fixture.away_team?.id}`}
          style={{ textAlign: 'center', flex: 1, color: 'inherit' }}
        >
          <Badge logoUrl={fixture.away_team?.logo_url} name={fixture.away_team?.name} />
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>{fixture.away_team?.name}</div>
        </Link>
      </div>

      {played && (
        <>
          <div style={{ display: 'flex', gap: 32, marginBottom: 28 }}>
            <ScorerColumn title={fixture.home_team?.name} scorers={homeScorers} />
            <ScorerColumn title={fixture.away_team?.name} scorers={awayScorers} />
          </div>

          {(homeCards.length > 0 || awayCards.length > 0) && (
            <div style={{ display: 'flex', gap: 32 }}>
              <DisciplineColumn title={fixture.home_team?.name} cards={homeCards} />
              <DisciplineColumn title={fixture.away_team?.name} cards={awayCards} />
            </div>
          )}
        </>
      )}

      {!played && (
        <p style={{ color: 'var(--muted)', textAlign: 'center' }}>This fixture hasn't been played yet.</p>
      )}

      {previousMeetings.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--brass)',
              marginBottom: 14,
              paddingBottom: 8,
              borderBottom: '2px solid var(--line)',
            }}
          >
            Previous Meetings
          </h2>
          {previousMeetings.map((m) => (
            <div key={m.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                {m.competition_name} — {m.season} —{' '}
                {new Date(m.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginBottom: m.scorers.length ? 6 : 0 }}>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{m.home_team_name}</span>
                <span style={{ fontWeight: 800, minWidth: 60, textAlign: 'center' }}>
                  {m.home_goals != null && m.away_goals != null ? `${m.home_goals} - ${m.away_goals}` : 'v'}
                </span>
                <span style={{ flex: 1, fontWeight: 600 }}>{m.away_team_name}</span>
              </div>
              {m.comment && (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 6 }}>
                  {m.comment}
                </div>
              )}
              {m.scorers.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                  {m.scorers.filter((s) => s.team_name === m.home_team_name).length > 0 && (
                    <div>
                      <strong>{m.home_team_name}:</strong>{' '}
                      {m.scorers
                        .filter((s) => s.team_name === m.home_team_name)
                        .map((s, i, arr) => (
                          <span key={i}>
                            {s.player_name} ({s.goals}){i < arr.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                    </div>
                  )}
                  {m.scorers.filter((s) => s.team_name === m.away_team_name).length > 0 && (
                    <div>
                      <strong>{m.away_team_name}:</strong>{' '}
                      {m.scorers
                        .filter((s) => s.team_name === m.away_team_name)
                        .map((s, i, arr) => (
                          <span key={i}>
                            {s.player_name} ({s.goals}){i < arr.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function ScorerColumn({ title, scorers }) {
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {title} scorers
      </h3>
      {scorers.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>No goals recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {scorers.map((s, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid var(--line)',
                fontSize: 14,
              }}
            >
              <span>
                {s.player?.first_name} {s.player?.last_name}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{s.goals}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DisciplineColumn({ title, cards }) {
  if (cards.length === 0) {
    return <div style={{ flex: 1 }} />
  }
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {title} cards
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {cards.map((c, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid var(--line)',
              fontSize: 14,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 14,
                background: c.card_type === 'red' ? '#B3261E' : '#F2C230',
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span>
              {c.player?.first_name} {c.player?.last_name}
              {c.card_count > 1 ? ` (${c.card_count}x)` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
