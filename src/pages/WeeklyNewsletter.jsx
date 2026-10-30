import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { displayedScore, fullOutcomeNote } from '../utils/fixtureOutcome'
import { useSiteLogos } from '../contexts/SiteLogos'
import './WeeklyNewsletter.css'

const editions = Object.values(import.meta.glob('../data/weekly/*.json', { eager: true, import: 'default' })).sort((a,b) => b.date.localeCompare(a.date))
const dateText = value => new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('en-GB', { timeZone:'Europe/London', day:'numeric',month:'long',year:'numeric' })
const shortName = name => name.replace(' Community Church','').replace(' Metropolitan Church','').replace(' Abbey Church','').replace(' United Salvation Army','').replace(' Baptist Church','').replace(/ Church$/,'')
const names = rows => rows.map(r => shortName(r.teamName)).join(' & ')
const fixtureGoals = f => f.went_to_extra_time && f.home_extra_time_score != null && f.away_extra_time_score != null ? [f.home_extra_time_score,f.away_extra_time_score] : [f.home_score,f.away_score]
function Badge({ team }) { return team?.logo_url ? <img className="weekly-badge" src={team.logo_url} alt="" loading="lazy" /> : null }
function MatchRow({ fixture, upcoming = false }) {
  const f = fixture
  return <Link to={`/fixtures/${f.id}`} className="weekly-match">
    <span className="weekly-eyebrow">{f.slug === 'appin-league' ? 'ECFA Appin Sports League' : f.competition}{f.round_name ? ` · ${f.round_name}` : ''}</span>
    <span className="weekly-match-teams"><span><Badge team={f.home_team}/>{shortName(f.home_team.name)}</span><b>{upcoming ? 'v' : displayedScore(f)}</b><span><Badge team={f.away_team}/>{shortName(f.away_team.name)}</span></span>
    <small>{dateText(f.fixture_date)}{upcoming ? ` · ${new Date(f.fixture_date).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})}` : ''}{f.venue && !/^(n\/a|league decide)$/i.test(f.venue) ? ` · ${f.venue}` : upcoming ? ' · Venue TBC' : ''}</small>
    {!upcoming && fullOutcomeNote(f) && <small>{fullOutcomeNote(f)}</small>}
  </Link>
}
function Stat({ title, value, children }) { return <div className="weekly-stat"><span className="weekly-eyebrow">{title}</span><strong>{value}</strong><div>{children}</div></div> }
function TeamLink({ row }) { return <Link to={`/teams/${row.teamId}`}>{shortName(row.teamName)}</Link> }

export default function WeeklyNewsletter() {
  const { editionDate } = useParams()
  const edition = editionDate ? editions.find(e => e.date === editionDate) : editions[0]
  const { siteLogo } = useSiteLogos()
  const [shareStatus,setShareStatus] = useState('')
  useEffect(() => {
    const previous = document.title
    document.title = edition ? `ECFA Weekly · ${dateText(edition.date)}` : 'ECFA Weekly · Edition not found'
    return () => { document.title = previous }
  },[edition])
  if (!edition) return <div className="container" style={{padding:'40px 20px'}}><h1>Edition not found</h1><p><Link to="/weekly">Read the latest ECFA Weekly →</Link></p></div>
  const e = edition
  const rows = e.tables.flatMap(t => t.rows)
  const leader = rows[0]
  const second = rows[1]
  const leadMatch = [...e.results].sort((a,b) => Math.max(...fixtureGoals(b)) - Math.max(...fixtureGoals(a)))[0]
  const winner = leadMatch ? fixtureGoals(leadMatch)[0] > fixtureGoals(leadMatch)[1] ? leadMatch.home_team : leadMatch.away_team : null
  const winningScore = leadMatch ? Math.max(...fixtureGoals(leadMatch)) : null
  const cupMatch = e.results.find(f => f.slug !== 'appin-league')
  const unbeaten = [...e.forms].sort((a,b)=>b.unbeaten-a.unbeaten)[0]
  const clean = [...e.forms].sort((a,b)=>b.cleanSheets-a.cleanSheets)[0]
  const shareUrl = `${window.location.origin}/weekly/${e.date}`
  async function share() {
    try {
      if (navigator.share) await navigator.share({title:`ECFA Weekly · ${dateText(e.date)}`,text:'Results, stories, stats and the week ahead.',url:shareUrl})
      else { await navigator.clipboard.writeText(shareUrl); setShareStatus('Edition link copied') }
    } catch(error) { if(error.name !== 'AbortError') setShareStatus('Use the WhatsApp button to share this edition.') }
  }
  return <div className="weekly-wrap">
    <div className="weekly-tools"><Link to="/news">← ECFA News</Link><div><button type="button" onClick={share}>Share edition</button><button type="button" onClick={()=>window.print()}>Print / save PDF</button><a href={`https://wa.me/?text=${encodeURIComponent(`ECFA Weekly · ${dateText(e.date)}\n${shareUrl}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a></div></div>
    <p role="status" className="weekly-share-status">{shareStatus}</p>
    <article className="weekly-paper">
      <header className="weekly-masthead">
        <div className="weekly-topline"><span>EDINBURGH CHURCHES FOOTBALL ASSOCIATION</span><span>ISSUE {String(e.issue).padStart(2,'0')} · {e.season.replace('-','/')}</span></div>
        <div className="weekly-title">{siteLogo('ecfa') && <img src={siteLogo('ecfa')} alt="ECFA"/>}<h1>ECFA <em>WEEKLY</em></h1></div>
        <div className="weekly-dateline"><time dateTime={e.date}>{dateText(e.date)}</time><span>THE RESULTS. THE STORIES. THE PEOPLE.</span></div>
        <nav className="weekly-sections" aria-label="Inside this edition"><a href="#weekly-roundup">The roundup</a><a href="#weekly-table">League table</a><a href="#weekly-scorers">Golden boot</a><a href="#weekly-referee">Meet the ref</a><a href="#weekly-next">Next up</a></nav>
      </header>
      <div className="weekly-lead-grid" id="weekly-roundup">
        <section className="weekly-lead">
          <span className="weekly-eyebrow">THE BIG STORY / {dateText(e.start)} – {dateText(e.date)}</span>
          <h2>{winner ? `${shortName(winner.name)} hit ${winningScore}` : 'The week in ECFA football'}</h2>
          <p className="weekly-deck">{leadMatch ? `${shortName(winner.name)} delivered the highest-scoring team performance of the week as ${e.results.length} completed fixtures produced ${e.totals.weeklyGoals} goals across the ECFA.` : 'Your weekly digest of the league, the cups and the people behind the game.'}</p>
          {leadMatch && <div className="weekly-score-hero"><Badge team={leadMatch.home_team}/><div><span>{shortName(leadMatch.home_team.name)}</span><strong>{displayedScore(leadMatch)}</strong><span>{shortName(leadMatch.away_team.name)}</span></div><Badge team={leadMatch.away_team}/></div>}
          <div className="weekly-copy-columns">
            {leader && <p><strong>The league picture.</strong> {shortName(leader.teamName)} head the ECFA Appin Sports League with {leader.points} points from {leader.played} matches{second ? `, ${leader.points-second.points} points ahead of ${shortName(second.teamName)}` : ''}. Their record stands at {leader.won} wins, {leader.drawn} draws and {leader.lost} defeats, with a goal difference of {leader.goalDifference > 0 ? '+' : ''}{leader.goalDifference}.</p>}
            {cupMatch && <p><strong>Cup watch.</strong> {shortName(cupMatch.home_team.name)} and {shortName(cupMatch.away_team.name)} finished {displayedScore(cupMatch)} in the {cupMatch.competition}{cupMatch.round_name ? ` ${cupMatch.round_name.toLowerCase()}` : ''}. <Link to={`/fixtures/${cupMatch.id}`}>Read the match details →</Link></p>}
            <p><strong>Across the season.</strong> The site records {e.totals.matches} completed league and cup matches with {e.totals.goals} goals so far—an average of {(e.totals.goals/e.totals.matches || 0).toFixed(2)} per match. The league accounts for {e.totals.leagueMatches} of those games and {e.totals.leagueGoals} goals.</p>
          </div>
        </section>
        <aside className="weekly-results"><h2>This week’s results</h2><p className="weekly-caption">All competitions · completed matches in this edition’s seven-day window.</p>{e.results.length ? e.results.map(f=><MatchRow key={f.id} fixture={f}/>) : <p>No completed results recorded this week.</p>}<Link className="weekly-text-link" to="/">Full Match Hub →</Link></aside>
      </div>
      <section className="weekly-numbers"><h2>The season in numbers <small>ECFA Appin Sports League only</small></h2><div className="weekly-stat-grid">
        <Stat title="Best attack" value={e.bestAttack[0]?.goalsFor ?? '—'}>{names(e.bestAttack)}<small>goals scored</small></Stat>
        <Stat title="Tightest defence" value={e.bestDefence[0]?.goalsAgainst ?? '—'}>{names(e.bestDefence)}<small>goals conceded · teams with games played</small></Stat>
        <Stat title="Most wins" value={e.mostWins[0]?.won ?? '—'}>{names(e.mostWins)}<small>league victories</small></Stat>
        <Stat title="Goals per game" value={(e.totals.leagueGoals/e.totals.leagueMatches || 0).toFixed(2)}>Across {e.totals.leagueMatches} league games<small>{e.totals.leagueGoals} goals recorded</small></Stat>
      </div></section>
      <div className="weekly-middle-grid">
        <section id="weekly-table"><span className="weekly-eyebrow">THE STATE OF PLAY</span><h2>ECFA Appin Sports League</h2><p className="weekly-caption">Complete table at {dateText(e.date)}. Points, then goal difference, then goals scored.</p>
          {e.tables.map(table=><div key={table.name}>{e.tables.length>1 && <h3>{table.name}</h3>}<div className="weekly-table-scroll" tabIndex="0" role="region" aria-label="League table, scroll horizontally for all columns"><table className="weekly-table"><thead><tr>{['#','Team','P','W','D','L','GF','GA','GD','Pts'].map(c=><th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{table.rows.map((r,i)=><tr key={r.teamId}><td>{i+1}</td><td><span className="weekly-table-team"><Badge team={{logo_url:r.teamLogo}}/><TeamLink row={r}/></span></td>{[r.played,r.won,r.drawn,r.lost,r.goalsFor,r.goalsAgainst,r.goalDifference>0?`+${r.goalDifference}`:r.goalDifference].map((n,j)=><td key={j}>{n}</td>)}<td><strong>{r.points}</strong></td></tr>)}</tbody></table></div></div>)}
          <div className="weekly-notebook"><h3>The form notebook</h3>{unbeaten && <p><strong>{shortName(unbeaten.teamName)}</strong> have the longest current league unbeaten run: <b>{unbeaten.unbeaten}</b> matches.</p>}{clean && <p><strong>{shortName(clean.teamName)}</strong> have kept <b>{clean.cleanSheets}</b> league clean sheets{e.forms.filter(f=>f.cleanSheets===clean.cleanSheets).length>1 ? `, sharing the highest total with ${e.forms.filter(f=>f.teamId!==clean.teamId && f.cleanSheets===clean.cleanSheets).map(f=>shortName(f.teamName)).join(', ')}` : ', the highest total' }.</p>}<p className="weekly-caption">Form runs count completed league matches, newest first when calculating the run; cup matches are excluded.</p></div>
        </section>
        <section id="weekly-scorers" className="weekly-scorers"><span className="weekly-eyebrow">THE GOLDEN BOOT RACE</span><h2>Goals that count</h2><p className="weekly-caption">{e.season.replace('-','/')} · All competitions. Top ten places, including ties at the cutoff.</p>
          {e.topScorers[0] && <p className="weekly-deck"><strong>{e.topScorers[0].name}</strong> leads the recorded charts with {e.topScorers[0].goals} goals{e.topScorers[1] ? `, ${e.topScorers[0].goals-e.topScorers[1].goals} ahead of the next total` : ''}.</p>}
          <ol className="weekly-scorer-list">{e.topScorers.map(s=><li key={s.name}><div><Link to={`/goalscorers?season=${encodeURIComponent(e.season.replace('-','/'))}&player=${encodeURIComponent(s.name)}`}>{s.name}</Link><small>{s.teams.map(t=>shortName(t.name)).join(' / ')}</small><small>{s.leagueGoals} league · {s.cupGoals} cup</small></div><strong>{s.goals}</strong></li>)}</ol>
          <p className="weekly-caption">Based on recorded scorer entries. Team goal totals can be higher where own goals or scorer details are not recorded.</p><Link className="weekly-text-link" to="/goalscorers?season=2026%2F27">Explore every scorer →</Link>
        </section>
      </div>
      <section className="weekly-form-section"><h2>Every team, at a glance</h2><p className="weekly-caption">League only · last five results, oldest to newest · W win, D draw, L loss.</p><div className="weekly-form-grid">{e.forms.map(r=><div className="weekly-form-team" key={r.teamId}><TeamLink row={r}/><span aria-label={r.form.join(', ')}>{r.form.map((letter,i)=><b key={i} className={`weekly-form-${letter}`}>{letter}</b>)}</span><small>{r.goalsFor} scored · {r.goalsAgainst} conceded · {r.cleanSheets} clean sheets</small></div>)}</div></section>
      <section className="weekly-ref-section" id="weekly-referee"><div><span className="weekly-eyebrow">THE PEOPLE BEHIND THE GAME</span><h2>Meet the ref</h2><p className="weekly-caption">A different public referee profile in each edition.</p></div>{e.referee ? <div className="weekly-ref-profile">{e.referee.photo_url && <img src={e.referee.photo_url} alt={e.referee.name} loading="lazy"/>}<div><h3>{e.referee.name}</h3><p className="weekly-ref-about">{e.referee.about}</p><dl>{(e.referee.survey_answers || []).filter(a=>a.answer?.trim()).map((a,i)=><div key={i}><dt>{a.question}</dt><dd>{a.answer}</dd></div>)}</dl><Link className="weekly-text-link" to={`/referees?ref=${encodeURIComponent(e.referee.name)}`}>Full profile & match history →</Link></div></div> : <p>A referee feature will appear when a published profile is available.</p>}</section>
      <div className="weekly-bottom-grid"><section id="weekly-next"><span className="weekly-eyebrow">DATES FOR YOUR DIARY</span><h2>The next matchday</h2><p className="weekly-caption">{e.nextDay ? dateText(e.nextDay) : 'No confirmed next matchday'} · All kick-off times are UK time.</p>{e.nextFixtures.map(f=><MatchRow key={f.id} fixture={f} upcoming/>)}<p className="weekly-caption">Appointments, venues, kick-off times and pitch conditions can change after publication. <Link to="/">Check the live Match Hub before travelling →</Link></p>{e.laterFixtures.length>0 && <details className="weekly-later"><summary>Further ahead · next four weeks</summary>{e.laterFixtures.map(f=><MatchRow key={f.id} fixture={f} upcoming/>)}</details>}</section>
        <section><span className="weekly-eyebrow">AROUND THE ASSOCIATION</span><h2>More than the score</h2>{e.news.length ? e.news.map(n=><article key={n.id} className="weekly-news-story"><time className="weekly-caption">{dateText(n.event_date)}</time><h3>{n.title}</h3><p>{n.body}</p>{n.graphics?.length>0 && <div className="weekly-news-posters">{n.graphics.slice(0,4).map((g,i)=><a key={g.url} href={g.url} target="_blank" rel="noopener noreferrer"><img src={g.url} alt={`${n.title} poster ${i+1}`} loading="lazy"/></a>)}</div>}<Link className="weekly-text-link" to={`/news#story-${n.id}`}>Event information & posters →</Link></article>):<p>Find the latest notices in <Link to="/news">ECFA News</Link>.</p>}
          <div className="weekly-notebook"><h3>Season’s goalfests</h3><p className="weekly-caption">The three highest-scoring completed matches across all competitions.</p>{e.bigGames.map(f=><MatchRow key={f.id} fixture={f}/>)}</div>
        </section></div>
      <footer className="weekly-foot"><span className="weekly-eyebrow">SUPPORTING ECFA FOOTBALL</span><div className="weekly-sponsors">{e.sponsors.map(s=><a key={s.id} href={s.website_url} target="_blank" rel="noopener noreferrer">{s.logo_url && <img src={s.logo_url} alt="" loading="lazy"/>}<span>{s.name}</span></a>)}</div><p>Edition frozen at {dateText(e.date)} from the ECFA website’s public records. League tables and team records cover league games; results and scorer totals cover all competitions unless labelled otherwise.</p><p><strong>READ. SHARE. SEE YOU NEXT SATURDAY.</strong></p></footer>
    </article>
    <section className="weekly-archive"><h2>Weekly editions</h2>{editions.map(issue=><Link key={issue.date} to={`/weekly/${issue.date}`} aria-current={issue.date===e.date?'page':undefined}>Issue {String(issue.issue).padStart(2,'0')} · {dateText(issue.date)} →</Link>)}</section>
  </div>
}
