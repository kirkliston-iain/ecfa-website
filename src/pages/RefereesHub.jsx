import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const CURRENT_SEASON_FALLBACK = ''

function GameRow({ f, showResult }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 4 }}>
        {f.compName}
        {f.round_name ? ` — ${f.round_name}` : ''}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
        {f.home_name} v {f.away_name}
        {showResult && f.home_score != null && f.away_score != null ? ` (${f.home_score}-${f.away_score})` : ''}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {new Date(f.fixture_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        {f.fixture_date.slice(11, 16) !== '00:00' ? `, ${f.fixture_date.slice(11, 16)}` : ''}
        {f.venue ? ` · ${f.venue}` : ''}
      </div>
    </div>
  )
}

export default function RefereesHub() {
  const [referees, setReferees] = useState([])
  const [refName, setRefName] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentSeason, setCurrentSeason] = useState(CURRENT_SEASON_FALLBACK)
  const [isAdmin, setIsAdmin] = useState(false)
  const [leagueTable, setLeagueTable] = useState([])

  const [lastGame, setLastGame] = useState(null)
  const [nextGame, setNextGame] = useState(null)
  const [allGames, setAllGames] = useState([]) // current season, played, from live fixtures
  const [historicGames, setHistoricGames] = useState([]) // from historic_fixtures
  const [seasonFilter, setSeasonFilter] = useState('')
  const [cardStats, setCardStats] = useState(null)

  useEffect(() => {
    supabase
      .from('admin_profiles')
      .select('id')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))

    supabase
      .from('referees')
      .select('id, name')
      .order('name')
      .then(({ data }) => setReferees(data || []))

    supabase
      .from('competitions')
      .select('season')
      .limit(1)
      .then(({ data }) => {
        const s = data?.[0]?.season || ''
        setCurrentSeason(s)
        setSeasonFilter(s)
      })
  }, [])

  useEffect(() => {
    if (!isAdmin || referees.length === 0) {
      setLeagueTable([])
      return
    }
    let cancelled = false
    async function load() {
      const { data: playedFixtures } = await supabase
        .from('fixtures')
        .select('id, referee_name')
        .eq('status', 'played')
        .not('referee_name', 'is', null)

      const gamesByRef = {}
      for (const f of playedFixtures || []) {
        gamesByRef[f.referee_name] = (gamesByRef[f.referee_name] || 0) + 1
      }

      const fixtureIds = (playedFixtures || []).map((f) => f.id)
      const cardsByRef = {}
      if (fixtureIds.length > 0) {
        const { data: cards } = await supabase
          .from('discipline_records')
          .select('card_count, fixture_id')
          .in('fixture_id', fixtureIds)
        const fixtureToRef = {}
        for (const f of playedFixtures || []) fixtureToRef[f.id] = f.referee_name
        for (const c of cards || []) {
          const ref = fixtureToRef[c.fixture_id]
          if (!ref) continue
          cardsByRef[ref] = (cardsByRef[ref] || 0) + (c.card_count || 0)
        }
      }

      const table = referees
        .map((r) => {
          const games = gamesByRef[r.name] || 0
          const cards = cardsByRef[r.name] || 0
          return { name: r.name, games, cards, rate: games ? cards / games : 0 }
        })
        .filter((r) => r.games > 0)
        .sort((a, b) => b.rate - a.rate)

      if (!cancelled) setLeagueTable(table)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAdmin, referees])

  useEffect(() => {
    if (!refName) {
      setLastGame(null)
      setNextGame(null)
      setAllGames([])
      setHistoricGames([])
      setCardStats(null)
      return
    }
    setLoading(true)

    async function load() {
      const { data: live } = await supabase
        .from('fixtures')
        .select(
          'id, fixture_date, venue, round_name, status, home_score, away_score, home_team:home_team_id(name), away_team:away_team_id(name), stage:stage_id(name, competition:competition_id(name))'
        )
        .eq('referee_name', refName)
        .order('fixture_date')

      const shaped = (live || []).map((f) => ({
        id: f.id,
        fixture_date: f.fixture_date,
        venue: f.venue,
        round_name: f.round_name,
        status: f.status,
        home_score: f.home_score,
        away_score: f.away_score,
        home_name: f.home_team?.name,
        away_name: f.away_team?.name,
        compName: f.stage?.competition?.name,
      }))

      const now = new Date()
      const played = shaped.filter((f) => f.status === 'played').sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
      const upcoming = shaped
        .filter((f) => f.status === 'scheduled' && new Date(f.fixture_date) >= now)
        .sort((a, b) => new Date(a.fixture_date) - new Date(b.fixture_date))

      setLastGame(played[0] || null)
      setNextGame(upcoming[0] || null)
      setAllGames(played)

      const { data: hist } = await supabase
        .from('historic_fixtures')
        .select('id, season, competition_name, fixture_date, home_team_name, home_goals, away_team_name, away_goals')
        .eq('referee_name', refName)
        .order('fixture_date', { ascending: false })

      setHistoricGames(
        (hist || []).map((h) => ({
          id: h.id,
          season: h.season,
          fixture_date: h.fixture_date,
          home_name: h.home_team_name,
          away_name: h.away_team_name,
          home_score: h.home_goals,
          away_score: h.away_goals,
          compName: h.competition_name,
        }))
      )

      // Card stats for the current season only — discipline records don't
      // survive a season archive, so this can't be computed for past seasons.
      if (played.length > 0) {
        const fixtureIds = played.map((f) => f.id)
        const { data: cards } = await supabase
          .from('discipline_records')
          .select('card_count, fixture_id')
          .in('fixture_id', fixtureIds)
        const totalCards = (cards || []).reduce((sum, c) => sum + (c.card_count || 0), 0)
        setCardStats({
          season: currentSeason,
          games: played.length,
          cards: totalCards,
          rate: played.length ? (totalCards / played.length).toFixed(2) : '0.00',
        })
      } else {
        setCardStats(null)
      }

      setLoading(false)
    }
    load()
  }, [refName, currentSeason])

  const seasonOptions = [currentSeason, ...Array.from(new Set(historicGames.map((h) => h.season)))].filter(Boolean)
  const gamesForSeason =
    seasonFilter === currentSeason
      ? allGames
      : historicGames.filter((h) => h.season === seasonFilter)

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Referees</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Fixture history and card stats for each match official.
      </p>

      {isAdmin && leagueTable.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={sectionHeaderStyle}>Cards League Table — {currentSeason} (Admin only)</h2>
          <div style={{ display: 'flex', fontSize: 11, color: 'var(--muted)', padding: '4px 0', fontWeight: 700 }}>
            <div style={{ flex: 1 }}>Referee</div>
            <div style={{ width: 50, textAlign: 'center' }}>Games</div>
            <div style={{ width: 50, textAlign: 'center' }}>Cards</div>
            <div style={{ width: 50, textAlign: 'center' }}>Rate</div>
          </div>
          {leagueTable.map((r, i) => (
            <div
              key={r.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 13,
                padding: '6px 0',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i + 1}. {r.name}
              </div>
              <div style={{ width: 50, textAlign: 'center' }}>{r.games}</div>
              <div style={{ width: 50, textAlign: 'center' }}>{r.cards}</div>
              <div style={{ width: 50, textAlign: 'center', fontWeight: 700 }}>{r.rate.toFixed(2)}</div>
            </div>
          ))}
        </section>
      )}

      <select value={refName} onChange={(e) => setRefName(e.target.value)} style={{ ...selectStyle, marginBottom: 24 }}>
        <option value="">Select a referee…</option>
        {referees.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {!loading && refName && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <div style={sectionLabelStyle}>Next Game</div>
              {nextGame ? (
                <GameRow f={nextGame} showResult={false} />
              ) : (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  No game assigned yet. This will populate once a fixture is assigned to them.
                </p>
              )}
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div style={sectionLabelStyle}>Last Game</div>
              {lastGame ? (
                <GameRow f={lastGame} showResult={true} />
              ) : (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>No games recorded yet.</p>
              )}
            </div>
          </div>

          {cardStats && (
            <>
              <h2 style={sectionHeaderStyle}>Cards Given — {cardStats.season}</h2>
              <div style={{ ...cardStyle, marginBottom: 28, display: 'flex', gap: 20 }}>
                <div>
                  <div style={statLabelStyle}>Games</div>
                  <div style={statValueStyle}>{cardStats.games}</div>
                </div>
                <div>
                  <div style={statLabelStyle}>Total cards</div>
                  <div style={statValueStyle}>{cardStats.cards}</div>
                </div>
                <div>
                  <div style={statLabelStyle}>Cards per game</div>
                  <div style={statValueStyle}>{cardStats.rate}</div>
                </div>
              </div>
            </>
          )}

          <h2 style={sectionHeaderStyle}>All Games</h2>
          {seasonOptions.length > 1 && (
            <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={{ ...selectStyle, marginBottom: 12 }}>
              {seasonOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {gamesForSeason.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No games recorded for this season.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gamesForSeason.map((f) => (
                <GameRow key={f.id} f={f} showResult={true} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 6,
  border: '1px solid var(--line)',
  background: '#fff',
}
const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 12,
}
const sectionLabelStyle = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  fontWeight: 700,
  marginBottom: 6,
}
const sectionHeaderStyle = {
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '2px solid var(--line)',
}
const statLabelStyle = {
  fontSize: 11,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}
const statValueStyle = {
  fontSize: 22,
  fontWeight: 800,
}
