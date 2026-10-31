import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { answerQuestion, dateLabel, matchDay, matchGoals } from '../utils/askEcfa.mjs'
import { loadAskRecords } from '../utils/askEcfaData'
import { historicDisplayedScore } from '../utils/historicFixtureOutcome'
import { outcomeNote } from '../utils/fixtureOutcome'
import './AskEcfa.css'

const examples = ['When did St Marys last lose?', 'Who has the best defence this season?', 'When did Liberton last beat Kirkliston?', 'What is Kirkliston’s unbeaten run?']
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()) }
export default function AskEcfa() {
  const [question,setQuestion] = useState('')
  const [season,setSeason] = useState('auto')
  const [scope,setScope] = useState('auto')
  const [records,setRecords] = useState(null)
  const [result,setResult] = useState(null)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const pending = useRef(false)
  const latestQuestion = useRef('')
  async function ask(value = question, nextSeason = season, nextScope = scope) {
    if (!value.trim() || pending.current) return
    pending.current = true; setBusy(true); setError(''); setResult(null); setQuestion(value); latestQuestion.current = value
    try {
      // Fetch afresh for each question so newly entered results are included.
      const data = await loadAskRecords()
      setRecords(data)
      setResult(answerQuestion(value,data,{today:today(),season:nextSeason,scope:nextScope}))
    } catch { setError('The records could not be loaded. Please try again; no answer has been calculated.') }
    finally { pending.current = false; setBusy(false) }
  }
  const seasons = [...new Set((records || []).map(m => m.season?.replace('-', '/')).filter(Boolean))].sort().reverse()
  function changeFilters(nextSeason,nextScope) {
    setSeason(nextSeason); setScope(nextScope)
    if (records && latestQuestion.current) setResult(answerQuestion(latestQuestion.current,records,{today:today(),season:nextSeason,scope:nextScope}))
  }
  return <section className="ask-ecfa" aria-labelledby="ask-ecfa-title">
    <span className="ask-ecfa-eyebrow">Results · Records · History</span>
    <h2 id="ask-ecfa-title">Ask ECFA</h2>
    <p>Ask a question about ECFA results, team records or upcoming fixtures.</p>
    <form onSubmit={e => { e.preventDefault(); ask() }} className="ecfa-question-form">
      <label className="ecfa-question-label" htmlFor="ecfa-question">What would you like to know?</label>
      <div className="ecfa-question-row"><input id="ecfa-question" type="text" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="When did St Marys last lose?" maxLength={300} required /><button type="submit" disabled={busy || !question.trim()}>{busy ? 'Checking…' : 'Ask ECFA'}</button></div>
      <div className="ecfa-question-filters">
        <label>Season<select value={season} disabled={busy} onChange={e=>changeFilters(e.target.value,scope)}><option value="auto">From my question</option><option value="all">All recorded seasons</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <label>Competitions<select value={scope} disabled={busy} onChange={e=>changeFilters(season,e.target.value)}><option value="auto">From my question</option><option value="all">All competitions</option><option value="league">League only</option><option value="cup">Cups only</option></select></label>
      </div>
    </form>
    <div className="ecfa-question-examples" aria-label="Example questions">{examples.map(example=><button key={example} type="button" disabled={busy} onClick={()=>ask(example)}>{example}</button>)}</div>
    <div aria-live="polite" aria-busy={busy}>
      {busy && <p>Checking current results and the historical archive…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <article className="ecfa-answer"><p className="ecfa-answer-context">{result.context}</p><h3>{latestQuestion.current}</h3><p className="ecfa-answer-text">{result.text}</p>
        {result.matches.map(m=><Link className="ecfa-answer-match" key={`${m.is_historic?'h':'l'}-${m.id}`} to={`/fixtures/${m.id}`}><span>{dateLabel(matchDay(m))} · {m.competition_name || 'Competition not recorded'}</span><strong>{m.home_team?.name} {m.status === 'played' ? m.is_historic ? historicDisplayedScore(m) : matchGoals(m).join(' – ') : 'v'} {m.away_team?.name}</strong>{!m.is_historic && outcomeNote(m) && <span>{outcomeNote(m)}</span>}<span>View match →</span></Link>)}
        <div className="ecfa-answer-links">{result.links.map(link=><Link key={link.to} to={link.to}>{link.label} →</Link>)}</div>
        <p className="ecfa-answer-note">Based on available public website records, checked {dateLabel(today())}. Historical records may be incomplete. Recorded penalty shootout winners count as wins/losses; shootout goals are excluded from goal totals.</p>
      </article>}
    </div>
    {!result && !busy && <p className="ecfa-answer-note">Try the examples above. If a question is not supported or records are missing, we’ll say so. Last-result questions search all recorded seasons; “best” and “most” questions default to the latest season. Use the filters to override.</p>}
  </section>
}
