import { TeamHistoryLink, VenueHistoryLink, CompetitionHistoryLink } from '../components/HistoryLinks'
import { matchHistoryUrl } from '../utils/historyLinks'
import { useRememberedState, useRememberedScroll } from '../hooks/usePageMemory'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { historicDisplayedScore } from '../utils/historicFixtureOutcome'

const CURRENT_SEASON_FALLBACK = ''

function GameRow({ f, showResult }) {
  return (
    <Link
      to={`/fixtures/${f.id}`}
      style={{ ...cardStyle, display: 'block', color: 'inherit', textDecoration: 'none' }}
      aria-label={`View ${f.home_name} versus ${f.away_name}`}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 4 }}>
        {f.compName}
        {f.round_name ? ` — ${f.round_name}` : ''}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
        {f.home_name} v {f.away_name}
        {showResult && f.home_score != null && f.away_score != null
          ? ` (${f.isHistoric ? historicDisplayedScore(f) : `${f.home_score}-${f.away_score}`})`
          : ''}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {new Date(f.fixture_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        {f.fixture_date.slice(11, 16) !== '00:00' ? `, ${f.fixture_date.slice(11, 16)}` : ''}
        {f.venue ? ` · ${f.venue}` : ''}
      </div>
    </Link>
  )
}

export default function RefereesHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [referees, setReferees] = useRememberedState('referees', [])
  const [refName, setRefName] = useRememberedState('refName', searchParams.get('ref') || '')
  const [loading, setLoading] = useRememberedState('loading', false)
  const [currentSeason, setCurrentSeason] = useRememberedState('currentSeason', CURRENT_SEASON_FALLBACK)
  const [signedIn, setSignedIn] = useRememberedState('signedIn', false)
  const [refereeContacts, setRefereeContacts] = useRememberedState('refereeContacts', {})

  const [lastGame, setLastGame] = useRememberedState('lastGame', null)
  const [nextGame, setNextGame] = useRememberedState('nextGame', null)
  const [allGames, setAllGames] = useRememberedState('allGames', []) // current season, played, from live fixtures
  const [historicGames, setHistoricGames] = useRememberedState('historicGames', []) // from historic_fixtures
  const [seasonFilter, setSeasonFilter] = useRememberedState('seasonFilter', '')
  useRememberedScroll(!loading)

  useEffect(() => {
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
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
    if (!signedIn) {
      setRefereeContacts({})
      return
    }

    let cancelled = false
    supabase
      .from('referee_contacts')
      .select('referee_id, mobile')
      .then(({ data, error }) => {
        if (cancelled || error) return
        setRefereeContacts(
          Object.fromEntries((data || []).map((contact) => [contact.referee_id, contact.mobile]))
        )
      })

    return () => {
      cancelled = true
    }
  }, [signedIn])

  useEffect(() => {
    if (!refName) {
      setLastGame(null)
      setNextGame(null)
      setAllGames([])
      setHistoricGames([])
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
        .eq('hidden_from_public', false)
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
        .select('id, season, competition_name, fixture_date, home_team_name, home_goals, away_team_name, away_goals, comment, penalty_winner_name')
        .eq('referee_name', refName)
        .order('fixture_date', { ascending: false })

      setHistoricGames(
        (hist || []).map((h) => ({
          id: h.id,
          season: h.season,
          venue: h.comment,
          fixture_date: h.fixture_date,
          home_name: h.home_team_name,
          away_name: h.away_team_name,
          home_score: h.home_goals,
          away_score: h.away_goals,
          compName: h.competition_name,
          home_team_name: h.home_team_name,
          home_goals: h.home_goals,
          away_team_name: h.away_team_name,
          away_goals: h.away_goals,
          comment: h.comment,
          penalty_winner_name: h.penalty_winner_name,
          isHistoric: true,
        }))
      )

      setLoading(false)
    }
    load()
  }, [refName, currentSeason])

  const seasonOptions = [currentSeason, ...Array.from(new Set(historicGames.map((h) => h.season)))].filter(Boolean)
  const gamesForSeason =
    seasonFilter === currentSeason
      ? allGames
      : historicGames.filter((h) => h.season === seasonFilter)

  const teamCounts = {}
  for (const g of gamesForSeason) {
    teamCounts[g.home_name] = (teamCounts[g.home_name] || 0) + 1
    teamCounts[g.away_name] = (teamCounts[g.away_name] || 0) + 1
  }
  const teamCountsList = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])

  const venueCounts = {}
  for (const g of gamesForSeason) {
    if (!g.venue) continue
    const v = g.venue.trim()
    if (['n/a', 'league decide', ''].includes(v.toLowerCase())) continue
    venueCounts[v] = (venueCounts[v] || 0) + 1
  }
  const venueCountsList = Object.entries(venueCounts).sort((a, b) => b[1] - a[1])
  const selectedReferee = referees.find((referee) => referee.name === refName)
  const selectedMobile = selectedReferee ? refereeContacts[selectedReferee.id] : ''

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Referees</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Fixture history for each match official.
      </p>

      <select value={refName} onChange={(e) => { setRefName(e.target.value); const next = new URLSearchParams(searchParams); next.set('ref', e.target.value); setSearchParams(next, { replace: true }) }} style={{ ...selectStyle, marginBottom: 16 }}>
        <option value="">Select a referee…</option>
        {referees.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>

      {signedIn && refName && selectedMobile && (
        <section style={{ ...cardStyle, marginBottom: 24, background: '#fff8df', borderColor: 'var(--brass)' }}>
          <div style={{ color: 'var(--brass)', fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>
            Manager contact — private
          </div>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>{refName}</div>
          <a
            href={`tel:${selectedMobile.replace(/\D/g, '')}`}
            style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 750, textDecoration: 'underline', textDecorationColor: 'var(--brass)', textUnderlineOffset: 3 }}
          >
            {selectedMobile}
          </a>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 6 }}>
            Visible only to signed-in managers.
          </div>
        </section>
      )}

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

          {seasonOptions.length > 1 && (
            <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={{ ...selectStyle, marginBottom: 20 }}>
              {seasonOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {teamCountsList.length > 0 && (
            <>
              <h2 style={sectionHeaderStyle}>Teams Officiated — {seasonFilter}</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                How many times this referee has taken charge of each team this season — with links to the matching games.
              </p>
              <div style={{ marginBottom: 28 }}>
                {teamCountsList.map(([team, count]) => (
                  <div key={team} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                    <TeamHistoryLink name={team} />
                    <Link to={matchHistoryUrl({ referee: refName, team, season: seasonFilter, status: 'played' })}><strong>{count}</strong></Link>
                  </div>
                ))}
              </div>
            </>
          )}

          {venueCountsList.length > 0 && (
            <>
              <h2 style={sectionHeaderStyle}>Venues — {seasonFilter}</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                How many times this referee has been at each venue this season.
              </p>
              <div style={{ marginBottom: 28 }}>
                {venueCountsList.map(([venue, count]) => (
                  <div key={venue} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                    <VenueHistoryLink name={venue} />
                    <Link to={matchHistoryUrl({ referee: refName, venue, season: seasonFilter, status: 'played' })}><strong>{count}</strong></Link>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 style={sectionHeaderStyle}>All Games</h2>
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
