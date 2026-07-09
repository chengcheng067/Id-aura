// Generator: export the built-in spec data (src/data/specs.bundled.js) to
// public/spec.json — the remote source that gets served via jsDelivr /
// GitHub raw. Run after editing specs.bundled.js to publish updated specs
// WITHOUT rebuilding the EXE (commit public/spec.json to the repo).
//
//   node scripts/gen-spec.mjs
import { specsData, specsVersion } from '../src/data/specs.bundled.js'
import { writeFileSync } from 'fs'

const data = specsData
const version = specsVersion
const catCount = Object.keys(data).length
const itemCount = Object.values(data).reduce(
  (sum, cat) => sum + (cat.sections || []).reduce((s, sec) => s + sec.items.length, 0),
  0,
)

writeFileSync('public/spec.json', JSON.stringify({ version, data }))
console.log(`public/spec.json written (version ${version}, ${catCount} categories, ${itemCount} items)`)
