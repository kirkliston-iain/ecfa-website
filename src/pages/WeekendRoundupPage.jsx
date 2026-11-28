import {Link} from 'react-router-dom'
import WeekendRoundup from '../components/WeekendRoundup'
export default function WeekendRoundupPage(){return <div className="container" style={{padding:'24px 12px 40px',maxWidth:1000}}><Link to="/" style={{fontSize:13,fontWeight:700,color:'var(--brass)'}}>← Back to Match Hub</Link><WeekendRoundup/></div>}
