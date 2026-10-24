import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { buildDisciplineHistory } from '../utils/disciplineHistory'

export default function DisciplineCardHistory({ playerId, teamId }) {
  const [games, setGames] = useState(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setGames(null)
    setError(false)
    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from('discipline_records')
          .select('fixture_id, player_id, card_type, card_count, player:player_id(first_name, last_name), team:team_id(name), fixture:fixture_id!inner(id, fixture_date, home_team:home_team_id(name), away_team:away_team_id(name), stage:stage_id(competition:competition_id(name, season)))')
          .eq(playerId ? 'player_id' : 'team_id', playerId || teamId)
        if (queryError) throw queryError
        const history = buildDisciplineHistory(data || [])
        if (active) setGames(history)
      } catch {
        if (active) setError(true)
      }
    }
    load()
    return () => { active = false }
  }, [playerId, teamId, attempt])

  return (
    <div>
      {error ? (
        <p role="alert">Could not load the card history. <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></p>
      ) : games === null ? (
        <p role="status">Loading card history…</p>
      ) : games.length === 0 ? (
        <p>No match-linked cards are available for this entry.</p>
      ) : (
        <ul>
          {games.map((game) => (
            <li key={`${game.id}-${game.playerId}`}>
              <Link to={`/fixtures/${game.id}`}>
                <span className="discipline-history-date">{game.fixture_date ? new Date(`${game.fixture_date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not recorded'}</span>
                {!playerId && <strong>{game.player ? `${game.player.first_name} ${game.player.last_name}` : 'Player not recorded'}</strong>}
                <strong>{game.home_team?.name || 'Home team'} v {game.away_team?.name || 'Away team'}</strong>
                <span className="discipline-history-meta">{[game.stage?.competition?.name, game.stage?.competition?.season, game.team?.name && `Playing for ${game.team.name}`].filter(Boolean).join(' · ')}</span>
                <span className="discipline-history-cards">
                  {game.yellow > 0 && <span><i className="discipline-card-yellow" aria-hidden="true" />{game.yellow} yellow{game.yellow === 1 ? '' : 's'}</span>}
                  {game.red > 0 && <span><i className="discipline-card-red" aria-hidden="true" />{game.red} red{game.red === 1 ? '' : 's'}</span>}
                  <b>{game.points} points</b>
                </span>
                <span className="discipline-history-date">View match →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
