import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { buildWeeklyEdition, londonDate } from '../src/utils/weeklyEdition.mjs'

const clientSource = await readFile(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')
const url = process.env.VITE_SUPABASE_URL || clientSource.match(/https:\/\/[^']+supabase.co/)[0]
const key = process.env.VITE_SUPABASE_ANON_KEY || clientSource.match(/'(eyJ[^']+)'/)[1]
const db = createClient(url,key,{auth:{persistSession:false}})
const queries = {
  competitions:'id,name,slug,season',
  fixtures:'id,fixture_date,status,hidden_from_public,stage_id,group_id,venue,home_score,away_score,round_name,went_to_extra_time,home_extra_time_score,away_extra_time_score,decided_by_penalties,home_penalty_score,away_penalty_score,home_team:home_team_id(id,name,logo_url),away_team:away_team_id(id,name,logo_url),stage:stage_id(competition:competition_id(id,name,slug,season))',
  referees:'id,name,photo_url,about,survey_answers',
  news_stories:'id,title,body,graphics,event_date,published_at',
  sponsors:'id,name,logo_url,website_url',
  stage_teams:'id,stage_id,group_id,team:team_id(id,name,logo_url)',
  fixture_scorers:'id,fixture_id,goals,player:player_id(id,first_name,last_name),team:team_id(id,name)',
  stages:'id,competition_id,stage_type,sort_order,groups(id,name,sort_order)',
}
async function load(table,select) {
  const rows=[]
  for(let offset=0;;offset+=1000) {
    let query=db.from(table).select(select).order('id').range(offset,offset+999)
    if(table==='fixtures') query=query.eq('hidden_from_public',false)
    if(table==='news_stories') query=query.eq('status','published')
    if(table==='sponsors') query=query.eq('is_published',true)
    const {data,error}=await query
    if(error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if(data.length<1000) return rows
  }
}
const date=process.argv[2] || londonDate(new Date())
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Use a YYYY-MM-DD edition date')
const raw=Object.fromEntries(await Promise.all(Object.entries(queries).map(async ([table,select])=>[table,await load(table,select)])))
const edition=buildWeeklyEdition(raw,date)
const dir=new URL('../src/data/weekly/',import.meta.url)
await mkdir(dir,{recursive:true})
await writeFile(new URL(`${date}.json`,dir),JSON.stringify(edition,null,2)+'\n')
console.log(`ECFA Weekly ${date}: ${edition.results.length} results; ${edition.tables.flatMap(t=>t.rows).length} teams; referee ${edition.referee?.name || 'none'}`)
