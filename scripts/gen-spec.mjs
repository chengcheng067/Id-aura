// Generator: export the built-in spec data (src/data/specs.bundled.js) to
// public/spec.json — the remote source that gets served via jsDelivr /
// GitHub raw. Run after editing specs.bundled.js to publish updated specs
// WITHOUT rebuilding the EXE (commit public/spec.json to the repo).
//
//   node scripts/gen-spec.mjs
import { specsData, specsVersion, specsApp } from '../src/data/specs.bundled.js'
import { writeFileSync, existsSync, readFileSync } from 'fs'

const data = specsData
const version = specsVersion

// Preserve an existing "app" node in the target spec.json. The published app
// version (app.latestVersion) is announced by a maintainer when they ship a new
// release; regenerating spec DATA must NOT clobber it back to the bundled
// default. Fall back to the bundled app node only when the target has none.
let app = specsApp
try {
  if (existsSync('spec.json')) {
    const existing = JSON.parse(readFileSync('spec.json', 'utf8'))
    if (existing.app && existing.app.latestVersion) app = existing.app
  }
} catch (_) {
  /* ignore — fall back to bundled app node */
}

const catCount = Object.keys(data).length
const itemCount = Object.values(data).reduce(
  (sum, cat) => sum + (cat.sections || []).reduce((s, sec) => s + sec.items.length, 0),
  0,
)

// Output to repo ROOT (the default spec source URL points at <repo>/spec.json,
// NOT public/spec.json). This is the file served via jsDelivr / GitHub raw.
writeFileSync('spec.json', JSON.stringify({ version, data, app }))
console.log(`spec.json written (version ${version}, ${catCount} categories, ${itemCount} items, app latestVersion ${app.latestVersion})`)
