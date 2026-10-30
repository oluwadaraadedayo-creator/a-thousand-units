// Run with: node scripts/check-functions.mjs
// Checks the things that quietly break a Vercel deployment on the free plan:
//  1. no more than 12 serverless functions (every .js file directly in /api that does not start with "_")
//  2. every route in api/files.js has a matching rewrite in vercel.json, and the other way round
//  3. nothing in api/_handlers is missing from the router, and no handler tries to set a per-function config
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const functions = readdirSync(join(root, 'api'), { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_')).map((e) => e.name)
if (functions.length > 12) problems.push(`There are ${functions.length} functions. The free plan allows 12: ${functions.join(', ')}`)

// Read the route names straight from the file, so this check needs no installed packages.
const routerSource = readFileSync(join(root, 'api', 'files.js'), 'utf8')
const block = routerSource.match(/export const ROUTES = \{([\s\S]*?)\n\}/)
if (!block) { console.log('Could not find ROUTES in api/files.js'); process.exit(1) }
const ROUTE_NAMES = [...block[1].matchAll(/^\s*'([a-z-]+)'\s*:/gm)].map((m) => m[1])
const rewrites = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).rewrites || []
const wanted = new Map(ROUTE_NAMES.map((n) => [`/api/${n}`, `/api/files?route=${n}`]))
for (const [src, dest] of wanted) if (!rewrites.some((r) => r.source === src && r.destination === dest)) problems.push(`Missing rewrite: ${src} -> ${dest}`)
for (const r of rewrites) if (!wanted.has(r.source)) problems.push(`Rewrite with no route: ${r.source}`)
for (const n of ROUTE_NAMES) if (functions.includes(`${n}.js`)) problems.push(`api/${n}.js exists as its own function and would shadow the rewrite`)

const handlers = readdirSync(join(root, 'api', '_handlers')).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''))
for (const h of handlers) if (!ROUTE_NAMES.includes(h)) problems.push(`api/_handlers/${h}.js is not in the router`)
for (const n of ROUTE_NAMES) if (!handlers.includes(n)) problems.push(`Route ${n} has no file in api/_handlers`)
for (const h of handlers) if (/export\s+const\s+config/.test(readFileSync(join(root, 'api', '_handlers', `${h}.js`), 'utf8'))) problems.push(`api/_handlers/${h}.js sets a config, which only works on a standalone function`)

console.log(`Functions (${functions.length} of 12 allowed): ${functions.join(', ')}`)
console.log(`Routes behind api/files.js (${ROUTE_NAMES.length}): ${ROUTE_NAMES.join(', ')}`)
if (problems.length) { console.log('\nPROBLEMS:\n- ' + problems.join('\n- ')); process.exit(1) }
console.log('\nAll good.')
