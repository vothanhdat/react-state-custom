// Runs the browser bench in headless Chrome: builds the page, serves it cross-origin isolated (for a
// fine-grained performance.now()), runs every case in shuffled rounds, checks what each consumer
// shows, writes results.json and prints the tables.
//
//   yarn bench:browser            full run, about 10 minutes
//   yarn bench:browser --quick    one short round to check the setup (writes dist/results.quick.json)
//
// CHROME=/path/to/chrome picks the browser; the default is Google Chrome on macOS.
import { build } from 'vite'
import { spawn, execSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarize } from './summarize.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const quick = process.argv.includes('--quick')
const ROUNDS = quick ? 1 : 3
const PROTOCOL = quick
  ? { scenarios: { warmup: 2, iterations: 10 }, nested: { warmup: 2, iterations: 5 } }
  : { scenarios: { warmup: 20, iterations: 100 }, nested: { warmup: 10, iterations: 40 } }
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const output = path.join(here, quick ? 'dist/results.quick.json' : 'results.json')

await build({ configFile: path.join(here, 'vite.config.ts') })
const dist = path.join(here, 'dist')

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' }
const server = http.createServer(async (req, res) => {
  const file = path.join(dist, new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'))
  if (!file.startsWith(dist)) { res.writeHead(403).end(); return }
  try {
    const body = await fs.readFile(file)
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }).end(body)
  } catch { res.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const pageUrl = `http://127.0.0.1:${server.address().port}/`

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'rsc-browser-bench-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1440,900', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })

try {
  const browserWs = await new Promise((resolve, reject) => {
    let log = ''
    chrome.stderr.on('data', chunk => {
      log += chunk
      const found = /DevTools listening on (ws:\/\/\S+)/.exec(log)
      if (found) resolve(found[1])
    })
    chrome.on('exit', code => reject(Error(`Chrome exited with ${code}: ${log}`)))
  })
  const devtools = `http://127.0.0.1:${new URL(browserWs).port}`
  const browser = await (await fetch(`${devtools}/json/version`)).json()
  const target = await (await fetch(`${devtools}/json/new?${pageUrl}`, { method: 'PUT' })).json()

  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  const pending = new Map()
  let nextId = 0
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    const call = pending.get(message.id)
    if (!call) return
    pending.delete(message.id)
    message.error ? call.reject(Error(message.error.message)) : call.resolve(message.result)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }

  for (let i = 0; i < 100 && !await evaluate('Boolean(window.benchmark)'); i++) await new Promise(r => setTimeout(r, 100))
  const manifest = await evaluate('window.benchmark.manifest()')
  if (!manifest.production) throw Error('the page is not a production build')
  if (!manifest.crossOriginIsolated) throw Error('the page is not cross-origin isolated: performance.now() would be coarse')

  const version = async name => JSON.parse(await fs.readFile(path.join(repo, 'node_modules', name, 'package.json'), 'utf8')).version
  // the library and the bench; the demo examples under src do not change what is measured
  const modified = execSync('git status --porcelain -- src/state-utils src/index.ts bench', { cwd: repo }).toString().trim() !== ''
  const data = {
    environment: {
      date: new Date().toISOString(),
      commit: execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim() + (modified ? ' (with local changes)' : ''),
      chrome: browser.Browser,
      userAgent: manifest.userAgent,
      cpu: os.cpus()[0].model,
      cores: os.cpus().length,
      memoryGB: Math.round(os.totalmem() / 2 ** 30),
      os: `${os.platform()} ${os.release()} ${os.arch()}`,
      node: process.version,
      versions: Object.fromEntries(await Promise.all(['react', 'react-dom', 'zustand', 'jotai'].map(async n => [n, await version(n)]))),
      viewport: manifest.viewport,
    },
    protocol: { rounds: ROUNDS, ...PROTOCOL },
    runs: [],
  }

  // A seeded shuffle, so a library never runs in the same slot of every round.
  let seed = 20261004
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32
  const shuffle = list => {
    const out = [...list]
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1));[out[i], out[j]] = [out[j], out[i]] }
    return out
  }

  // Cases without reference values must all show what the first library of their scenario showed.
  const shown = new Map()
  const total = ROUNDS * manifest.cases.length
  for (let round = 0; round < ROUNDS; round++) {
    for (const c of shuffle(manifest.cases)) {
      const { warmup, iterations } = PROTOCOL[c.suite]
      const r = await evaluate(`window.benchmark.runCase(${JSON.stringify(c.id)}, ${warmup}, ${iterations})`)
      if (r.mismatch) throw Error(`${c.id}: ${r.mismatch}`)
      if (r.values) {
        const first = shown.get(c.scenario)
        if (!first) shown.set(c.scenario, { library: c.library, values: r.values })
        else {
          const i = r.values.findIndex((v, i) => Math.abs(v - first.values[i]) > 1e-9 * Math.max(1, Math.abs(v)))
          if (i >= 0) throw Error(`${c.id}: consumer ${i} shows ${r.values[i]}, ${first.library} showed ${first.values[i]}`)
        }
      }
      data.runs.push({
        round, id: c.id, suite: c.suite, scenario: c.scenario, library: c.library,
        perUpdate: r.perUpdate, samples: r.samples.map(ms => Math.round(ms * 1000) / 1000),
      })
      process.stdout.write(`\r${data.runs.length}/${total} ${c.id}`.padEnd(120).slice(0, 120))
    }
  }
  process.stdout.write('\n')
  const order = new Map(manifest.cases.map((c, i) => [c.id, i]))
  data.runs.sort((a, b) => order.get(a.id) - order.get(b.id) || a.round - b.round)
  await fs.writeFile(output, JSON.stringify(data) + '\n')
  console.log(`wrote ${path.relative(repo, output)}\n`)
  console.log(summarize(data))
  socket.close()
} finally {
  chrome.kill()
  server.close()
  await fs.rm(profile, { recursive: true, force: true }).catch(() => { })
}
