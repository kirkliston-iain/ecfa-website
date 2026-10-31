import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { answerQuestion, dateLabel, matchDay, matchGoals } from '../utils/askEcfa.mjs'
import { loadAskRecords } from '../utils/askEcfaData'
import { historicDisplayedScore } from '../utils/historicFixtureOutcome'
import { outcomeNote } from '../utils/fixtureOutcome'
import './AskEcfa.css'

function today() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()) }
export default function AskEcfa() {
  const [question,setQuestion] = useState('')
  const [result,setResult] = useState(null)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const pending = useRef(false)
  const latestQuestion = useRef('')
  async function ask(value = question) {
    if (!value.trim() || pending.current) return
    pending.current = true; setBusy(true); setError(''); setResult(null); setQuestion(value); latestQuestion.current = value
    try {
      // Fetch afresh for each question so newly entered results are included.
      const data = await loadAskRecords()
      setResult(answerQuestion(value,data,{today:today()}))
    } catch { setError('The records could not be loaded. Please try again; no answer has been calculated.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="ask-ecfa" aria-labelledby="ask-ecfa-title">
    <span className="ask-ecfa-eyebrow">Results · Records · History</span>
    <h2 id="ask-ecfa-title">Ask ECFA</h2>
    <p>Ask a question about ECFA results, team records or upcoming fixtures.</p>
    <form onSubmit={e => { e.preventDefault(); ask() }} className="ecfa-question-form">
      <label className="ecfa-question-label" htmlFor="ecfa-question">What would you like to know?</label>
      <div className="ecfa-question-row"><input id="ecfa-question" type="text" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type your question…" maxLength={300} required /><button type="submit" disabled={busy || !question.trim()}>{busy ? 'Checking…' : 'Ask ECFA'}</button></div>
    </form>
    <div aria-live="polite" aria-busy={busy}>
      {busy && <p>Checking current results and the historical archive…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <article className="ecfa-answer"><p className="ecfa-answer-context">{result.context}</p><h3>{latestQuestion.current}</h3><p className="ecfa-answer-text">{result.text}</p>
        {result.matches.map(m=><Link className="ecfa-answer-match" key={`${m.is_historic?'h':'l'}-${m.id}`} to={`/fixtures/${m.id}`}><span>{dateLabel(matchDay(m))} · {m.competition_name || 'Competition not recorded'}</span><strong>{m.home_team?.name} {m.status === 'played' ? m.is_historic ? historicDisplayedScore(m) : matchGoals(m).join(' – ') : 'v'} {m.away_team?.name}</strong>{!m.is_historic && outcomeNote(m) && <span>{outcomeNote(m)}</span>}<span>View match →</span></Link>)}
        <div className="ecfa-answer-links">{result.links.map(link=><Link key={link.to} to={link.to}>{link.label} →</Link>)}</div>
        <p className="ecfa-answer-note">Based on available public website records, checked {dateLabel(today())}. Historical records may be incomplete. Recorded penalty shootout winners count as wins/losses; shootout goals are excluded from goal totals.</p>
      </article>}
    </div>
    {!result && !busy && <p className="ecfa-answer-note">Include any season, competition or dates in your question.</p>}
  </section>
}
