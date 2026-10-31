import { createHash } from 'node:crypto'
import { createRecordReader, todayLondon } from '../server/ecfaRecords.mjs'
import { answerFromRecords } from '../server/recordAnswers.mjs'

export const config = { maxDuration: 30 }
// Short-lived answer cache and bounded request tracking for public record lookups.
const requests=new Map(),answers=new Map()
export function acceptQuestion(body) {
 const question=body?.question
 if(typeof question!=='string'||!question.trim()||question.length>500)throw Error('Enter a question of 1–500 characters.')
 return question.trim()
}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use the Ask ECFA question box.'})}
 const origin=req.headers.origin
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Please use Ask ECFA on the ECFA website.'})}catch{return res.status(403).json({error:'Invalid request origin.'})}}
 let question
 try{question=acceptQuestion(typeof req.body==='string'?JSON.parse(req.body):req.body)}catch{return res.status(400).json({error:'Enter a question of 1–500 characters.'})}
 const now=Date.now()
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()
 const visitor=createHash('sha256').update(ip).digest('hex')
 if(requests.size>5000)requests.clear()
 const window=requests.get(visitor)
 if(window && now-window.start<600000 && window.count>=30){res.setHeader('Retry-After','60');return res.status(429).json({error:'Please wait a minute before asking another question.'})}
 requests.set(visitor,window&&now-window.start<600000?{...window,count:window.count+1}:{start:now,count:1})
 const key=createHash('sha256').update(question.toLowerCase()).digest('hex'),cached=answers.get(key)
 if(cached&&now-cached.at<60000)return res.status(200).json(cached.result)
 const signal=AbortSignal.timeout(25000)
 const reader=createRecordReader(signal)
 try {
  const result=await answerFromRecords(question,reader,{today:todayLondon(),signal})
  if(answers.size>=100)answers.clear()
  answers.set(key,{at:Date.now(),result})
  return res.status(200).json(result)
 } catch {
  console.error('Ask ECFA public record lookup failed')
  return res.status(503).json({error:'The ECFA records could not be loaded. Please try again shortly.'})
 }
}
