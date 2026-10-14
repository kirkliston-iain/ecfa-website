// Exercise mount effects as well as rendering: a production build does not catch
// runtime exceptions in the directory's empty-selection branch.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const esbuild = require('esbuild')
const jsx = require('react/jsx-runtime')
const code = esbuild.transformSync(fs.readFileSync(process.argv[2] || 'src/pages/RefereesHub.jsx', 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code
async function mount(refereeName) {
  const effects = []
  const state = new Map()
  const query = new Proxy({}, { get: (_, key) => key === 'then' ? (resolve) => Promise.resolve({ data: [], error: null }).then(resolve) : () => query })
  const modules = {
    react: { useEffect: (effect) => effects.push(effect) },
    'react/jsx-runtime': jsx,
    'react-router-dom': { Link: 'a', useSearchParams: () => [new URLSearchParams(refereeName ? { ref: refereeName } : {}), () => {}] },
    '../hooks/usePageMemory': { useRememberedState: (name, initial) => { state.set(name, initial); return [initial, (value) => state.set(name, value)] }, useRememberedScroll: () => {} },
    '../supabaseClient': { supabase: { from: () => query, auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } },
    '../components/HistoryLinks': { TeamHistoryLink: 'a', VenueHistoryLink: 'a', CompetitionHistoryLink: 'a' },
    '../utils/historyLinks': { matchHistoryUrl: () => '/matches' },
    '../utils/historicFixtureOutcome': { historicDisplayedScore: () => '' },
    './RefereeProfiles.css': {},
  }
  const exports = {}
  const testModule = { exports }
  vm.runInNewContext(code, { exports, module: testModule, require: (name) => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name] }, Date, URLSearchParams })
  assert.ok(testModule.exports.default(), 'Directory should render')
  for (const effect of effects) effect()
  for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.equal(state.get('loading'), false)
  assert.equal(state.get('loadError'), '')
}
;(async () => { await mount(''); await mount('Test Referee'); console.log('Referee directory and selected-profile mount checks passed.') })().catch((error) => { console.error(error); process.exit(1) })
