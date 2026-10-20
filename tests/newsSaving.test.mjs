import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../src/pages/NewsAdmin.jsx', import.meta.url), 'utf8')
const saveSource = source.slice(source.indexOf('  async function save('), source.indexOf('  async function changeStatus('))

async function run({ storyUrl = null, uploadError = null, throws = false } = {}) {
  const calls = { uploaded: [], payload: null, error: '', working: false, reset: false }
  const context = {
    form: { title: 'ECFA Charity Day', body: 'Charity day details', story_url: storyUrl, event_date: '2026-11-07', graphics: [], status: 'published' },
    working: false, editingId: 'story-1', stories: [{ id: 'story-1', graphics: [], published_at: '2026-10-20T09:00:00Z' }],
    files: [{ name: 'charity.png', type: 'image/png' }], crypto: { randomUUID: () => 'image-id' }, fileName: (f) => f.name,
    URL, setError: (e) => { calls.error = e }, setMessage: () => {}, setWorking: (v) => { calls.working = v },
    startNew: () => { calls.reset = true }, loadStories: async () => {}, removeUploads: async () => null,
    supabase: {
      storage: { from: () => ({ upload: async (path) => {
        calls.uploaded.push(path)
        if (throws) throw new Error('Connection lost')
        return { error: uploadError }
      }, getPublicUrl: (path) => ({ data: { publicUrl: `https://example.test/${path}` } }) }) },
      from: () => ({ update: (payload) => { calls.payload = payload; return { eq: async () => ({ error: null }) } } }),
    },
  }
  vm.createContext(context)
  await vm.runInContext(`${saveSource}\nsave({ preventDefault() {} }, 'published')`, context)
  return calls
}

for (const storyUrl of [null, '', 'https://example.test/story']) {
  const result = await run({ storyUrl })
  assert.equal(result.error, '')
  assert.equal(result.uploaded.length, 1)
  assert.equal(result.payload.graphics.length, 1)
  assert.equal(result.payload.story_url, storyUrl || null)
  assert.equal(result.reset, true)
  assert.equal(result.working, false)
}
const failed = await run({ uploadError: { message: 'Upload refused' } })
assert.match(failed.error, /Upload refused/)
assert.equal(failed.payload, null)
assert.equal(failed.reset, false)
assert.equal(failed.working, false)
const interrupted = await run({ throws: true })
assert.match(interrupted.error, /Connection lost/)
assert.equal(interrupted.reset, false)
assert.equal(interrupted.working, false)
console.log('News save regression checks passed: blank links, image persistence, upload failures and interrupted saves.')
